// import fetch from 'node-fetch'
import { load } from 'cheerio'
import { apiKey, nineAnimeResolver } from './keys.js'

const baseUrl = 'https://9anime.pl'

export async function fetchAnimeInfo (id) {
  const animeInfo = {
    id
  }

  const res = await fetch(baseUrl + '/watch/' + id)
  const $ = load(await res.text())

  const main = $('#watch-main').attr('data-id')
  const vrf = await ev(main)

  const res2 = await fetch(`${baseUrl}/ajax/episode/list/${main}?vrf=${encodeURIComponent(vrf)}`)

  const json = await res2.json()

  const $$ = load(json.result)

  const episodes = []
  $$('div.episodes > ul > li > a').each((i, el) => {
    $$(el)
      .each((i, el) => {
        const possibleIds = $$(el).attr('data-ids')?.split(',')
        const number = parseInt($$(el).attr('data-num')?.toString())
        const title = $$(el).find('span').text().length > 0 ? $$(el).find('span').text() : undefined

        episodes.push({
          id: possibleIds[0],
          fallbackId: possibleIds[1],
          number,
          title
        })
      })
      .get()
  })
  animeInfo.episodes = episodes

  return animeInfo
}

export async function fetchEpisodeSources (episodeId, fallbackId) {
  let servers = await fetchEpisodeServers(episodeId)
  let s = servers.find(s => s.name === 'vidstream')

  if (!s) {
    servers = await fetchEpisodeServers(fallbackId)
    s = servers.find(s => s.name === 'vidstream')
  }

  if (!s) return true

  const serverVrfRes = (
    await fetch(
      `${nineAnimeResolver}/vrf?query=${encodeURIComponent(s.url)}&apikey=${apiKey}`
    )
  )

  const serverVrf = (await serverVrfRes.json()).url

  const serverSource = await (await fetch(`${baseUrl}/ajax/server/${s.url}?vrf=${encodeURIComponent(serverVrf)}`)).json()

  const [urlRes, skipRes] = await Promise.all([
    fetch(`${nineAnimeResolver}/decrypt?query=${encodeURIComponent(serverSource.result.url)}&apikey=${apiKey}`),
    fetch(`${nineAnimeResolver}/decrypt?query=${encodeURIComponent(serverSource.result.skip_data)}&apikey=${apiKey}`)
  ])

  const [{ url: embedURL }, { url: skip }] = await Promise.all([
    urlRes.json(),
    skipRes.json()
  ])

  if (embedURL.startsWith('http')) {
    const vizID = new URL(embedURL).href.split('/')
    if (!vizID.length) throw new Error('Video not found')
    const res = await fetch(`${nineAnimeResolver}/rawVizcloud?query=${encodeURIComponent(vizID.pop() ?? '')}&apikey=${apiKey}`)

    const head = await res.json()

    const playlistRes = await fetch(head.rawURL)
    const json = await playlistRes.json()
    if (!json.data?.media) throw new Error('Video not found')
    const sources = json.data.media.sources.map(source => ({
      url: source.file,
      quality: 'auto',
      isM3U8: false
    }))

    const main = sources[sources.length - 1].url

    const qualitiesRes = await fetch(main, {
      method: 'get',
      headers: { referer: 'https://9anime.to' }
    })

    const text = await qualitiesRes.text()

    const resolutions = text.match(/(RESOLUTION=)(.*)(\s*?)(\s*.*)/g)
    resolutions?.forEach(res => {
      const index = main.lastIndexOf('/')
      const quality = res.split('\n')[0].split('x')[1].split(',')[0]
      const url = main.slice(0, index)
      sources.push({
        url: url + '/' + res.split('\n')[1],
        isM3U8: (url + res.split('\n')[1]).includes('.m3u8'),
        quality: quality + 'p'
      })
    })

    const response = {
      sources,
      embedURL,
      skip: JSON.parse(skip)
    }

    return response
  } else {
    return true
  }
}

async function fetchEpisodeServers (episodeId) {
  const url = `${baseUrl}/ajax/server/list/${episodeId}?vrf=${encodeURIComponent(await ev(episodeId))}`

  const res = await fetch(url)

  const json = await res.json()
  const $ = load(json.result)
  const servers = []
  $('.type > ul > li').each((i, el) => {
    const serverId = $(el).attr('data-link-id')
    servers.push({
      name: $(el).text().toLocaleLowerCase(),
      url: `${serverId}`
    })
  })

  return servers
}

async function ev (query, raw) {
  const res = await fetch(
    `${nineAnimeResolver}/vrf?query=${encodeURIComponent(query)}&apikey=${apiKey}`
  )

  const data = await res.json()

  if (raw) {
    return data
  } else {
    return data.url
  }
}

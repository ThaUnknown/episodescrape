import fetch from 'node-fetch'
import { load } from 'cheerio'
import CryptoJS from 'crypto-js'

const baseURL = 'https://zoro.to'
const host = 'https://rapid-cloud.co'

export async function fetchAnimeInfo (id) {
  const info = {
    id
  }
  const res = await fetch(`${baseURL}/watch/${id}`)
  const data = await res.text()
  const $ = load(data)
  const { mal_id } = JSON.parse($('#syncData').text())
  info.malID = Number(mal_id)
  info.title = $('h2.film-name > a.text-white').text()
  info.image = $('img.film-poster-img').attr('src')
  info.description = $('div.film-description').text().trim()
  info.type = $('span.item').last().prev().prev().text().toUpperCase()
  info.url = `${baseURL}/${id}`

  const episodesAjaxRes = await fetch(`${baseURL}/ajax/v2/episode/list/${id.split('-').pop()}`, {
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      Referer: `${baseURL}/watch/${id}`
    }
  })
  const { html } = await episodesAjaxRes.json()

  const $$ = load(html)

  info.totalEpisodes = $$('div.detail-infor-content > div > a').length
  info.episodes = []
  $$('div.detail-infor-content > div > a').each((i, el) => {
    const episodeId = $$(el).attr('href')
      ?.split('/')[2]
      ?.replace('?ep=', '$episode$')
      ?.concat(`$${info.subOrDub}`)
    const number = parseInt($$(el).attr('data-number'))
    const title = $$(el).attr('title')
    const url = baseURL + $$(el).attr('href')
    const isFiller = $$(el).hasClass('ssl-item-filler')

    info.episodes?.push({
      id: episodeId,
      number,
      title,
      isFiller,
      url
    })
  })

  return info
}

function retrieveServerId ($, index, subOrDub) {
  let el = $(`div.ps_-block.ps_-block-sub.servers-${subOrDub} > div.ps__-list > div`)
    .map((i, el) => {
      return ($(el).attr('data-server-id') == `${index}` ? $(el) : null)
    })
    .get()
  if (!el[0]) {
    el = $('div.ps_-block.ps_-block-sub.servers-raw > div.ps__-list > div')
      .map((i, el) => {
        return ($(el).attr('data-server-id') == `${index}` ? $(el) : null)
      })
      .get()
  }
  if (!el[0]) {
    el = $('div.ps_-block.ps_-block-sub.servers-dub > div.ps__-list > div')
      .map((i, el) => {
        return ($(el).attr('data-server-id') == `${index}` ? $(el) : null)
      })
      .get()
  }
  if (!el[0]) return null
  return el[0].attr('data-id')
};

export async function fetchEpisodeSources (episodeId) {
  const subOrDub = episodeId.split('$')?.pop() === 'dub' ? 'dub' : 'sub'

  episodeId = `${baseURL}/watch/${episodeId
    .replace('$episode$', '?ep=')
    .replace(/\$auto|\$sub|\$dub/gi, '')}`

  const res = await fetch(`${baseURL}/ajax/v2/episode/servers?episodeId=${episodeId.split('?ep=')[1]}`)
  const { html } = await res.json()

  const $ = load(html)

  const serverId = retrieveServerId($, 1, subOrDub)

  if (!serverId) return null

  const sourcesRes = await fetch(`${baseURL}/ajax/v2/episode/sources?id=${serverId}`)
  const data = await sourcesRes.json()
  const link = new URL(data.link)

  const result = {
    sources: [],
    subtitles: []
  }
  const id = link.href.split('/').pop()?.split('?')[0]
  const options = {
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    }
  }

  const extractRes = await fetch(`${host}/ajax/embed-6/getSources?id=${id}`, options)

  let { sources, tracks, intro, encrypted } = await extractRes.json()

  const decryptkey = (async () => {
    const res = await fetch('https://raw.githubusercontent.com/enimax-anime/key/e6/key.txt')
    return res.text()
  })()

  try {
    if (encrypted) {
      const decrypt = CryptoJS.AES.decrypt(sources, await decryptkey)
      sources = JSON.parse(decrypt.toString(CryptoJS.enc.Utf8))
    }
  } catch (err) {
    throw new Error('Cannot decrypt sources. Perhaps the key is invalid.')
  }

  let srcs = sources?.map(s => ({
    url: s.file,
    isM3U8: s.file.includes('.m3u8')
  }))

  result.sources.push(...srcs)

  if (link.href.includes(new URL(host).host)) {
    result.sources = []
    srcs = []
    for (const source of sources) {
      const res = await fetch(source.file, options)
      const data = await res.text()
      const m3u8data = data
        .split('\n')
        .filter(line => line.includes('.m3u8') && line.includes('RESOLUTION='))

      const secondHalf = m3u8data.map(line =>
        line.match(/RESOLUTION=.*,(C)|URI=.*/g)?.map(s => s.split('=')[1])
      )

      const TdArray = secondHalf.map(s => {
        const f1 = s[0].split(',C')[0]
        const f2 = s[1].replace(/"/g, '')

        return [f1, f2]
      })
      for (const [f1, f2] of TdArray) {
        srcs.push({
          url: `${source.file?.split('master.m3u8')[0]}${f2.replace('iframes', 'index')}`,
          quality: f1.split('x')[1] + 'p',
          isM3U8: f2.includes('.m3u8')
        })
      }
      result.sources.push(...srcs)
    }
    if (intro.end > 1) {
      result.intro = {
        start: intro.start,
        end: intro.end
      }
    }
  }

  result.sources.push({
    url: sources[0].file,
    isM3U8: sources[0].file.includes('.m3u8'),
    quality: 'auto'
  })

  result.subtitles = tracks
    .map(s =>
      s.file
        ? {
            url: s.file,
            lang: s.label ? s.label : 'Thumbnails'
          }
        : null
    )
    .filter(s => s)

  return result
}

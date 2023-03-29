import { fetchAnimeInfo, fetchEpisodeSources } from './9anime.js'
import { writeFile, readFile, readdir } from 'node:fs/promises'
// import fetch from 'node-fetch'
import Bottleneck from 'bottleneck'

const limiter = new Bottleneck({ maxConcurrent: 50 })

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function fetchAnimeEpisodeMetadata (id) {
  let info
  while (!info) {
    try {
      info = await limiter.schedule(() => fetchAnimeInfo(id))
    } catch (e) {
      console.log('failed to fetch info for', id, e)
      await sleep(15000)
    }
  }
  const promises = info.episodes.map(async episode => {
    let data
    while (!data) {
      try {
        data = await limiter.schedule(() => fetchEpisodeSources(episode.id, episode.fallbackId))
      } catch (e) {
        console.log('failed to fetch data for', episode.id, e)
        await sleep(15000)
      }
    }
    if (data === true) return {}
    let res
    const source = data.sources.find(source => source.isM3U8).url
    while (!res) {
      try {
        res = await fetch(source)
      } catch (e) {
        console.log('failed to fetch sources for', source, e)
        await sleep(15000)
      }
    }
    const text = await res.text()

    const regex = /^#EXTINF:(?:[0-9]*[.])?[0-9]+/gm

    let duration = 0
    for (const match of text.match(regex) || []) {
      duration += Number(match.slice(8))
    }
    const intro = data.skip?.intro?.[1] !== 0 ? data.skip?.intro : undefined
    const outro = data.skip?.outro?.[1] !== 0 ? data.skip?.outro : undefined
    return { duration: duration.toFixed(2), intro, outro, number: episode.number, title: episode.title }
  })

  return Promise.all(promises)
}

let episodeData = {}

async function scheduleSave (page) {
  console.log('saving', page, Object.keys(episodeData).length)
  await writeFile(`./data/9anime/${page}.json`, JSON.stringify(episodeData))
}

const malSyncPath = './mal-sync/data/pages/9anime/'

async function * animeList (page) {
  const files = await readdir(malSyncPath)
  for (let i = page; i < files.length; ++i) {
    console.log('read ', i)
    yield JSON.parse(await readFile(malSyncPath + files[i]))
    if (i % 10 === 0) {
      await scheduleSave((i / 10) | 0)
      episodeData = {}
    }
  }
}

for await (const anime of animeList(491)) {
  if (anime.malId) {
    console.log('requesting ', anime.malId)
    const epData = await fetchAnimeEpisodeMetadata(anime.url.slice(anime.url.lastIndexOf('/') + 1))
    console.log(anime.malId, epData)
    episodeData[anime.malId] = epData
  }
}

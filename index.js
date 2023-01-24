import { writeFile } from 'node:fs/promises'
import { load } from 'cheerio'
import fetch from 'node-fetch'
import { fetchAnimeInfo, fetchEpisodeSources } from './lib/zoro.js'
import Bottleneck from 'bottleneck'

const limiter = new Bottleneck({ maxConcurrent: 20 })

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
// const search = await zoro.search("Akebi's Sailor Uniform")
// const x = await fetchAnimeEpisodeMetadata('a-day-before-us-season-zero-3782')
// console.log(x)
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
        data = await limiter.schedule(() => fetchEpisodeSources(episode.id))
      } catch (e) {
        console.log('failed to fetch data for', episode.id, e)
        await sleep(15000)
      }
    }
    if (data === true) return {}
    let res
    while (!res) {
      try {
        res = await fetch(data.sources[0].url)
      } catch (e) {
        console.log('failed to fetch sources for', data.sources[0].url, e)
        await sleep(15000)
      }
    }
    const text = await res.text()

    const regex = /^#EXTINF:(?:[0-9]*[.])?[0-9]+/gm

    let duration = 0
    for (const match of text.match(regex) || []) {
      duration += Number(match.slice(8))
    }
    return { duration: duration.toFixed(2), intro: data.intro, number: episode.number, title: episode.title }
  })

  return [info.malID, await Promise.all(promises)]
}

let episodeData = null

async function scheduleSave (page) {
  await writeFile(`./data/${page}.json`, JSON.stringify(episodeData))
}

async function * animeList (page) {
  let hasNextPage = true
  while (hasNextPage) {
    let res
    while (!res) {
      try {
        res = await fetch(`https://zoro.to/az-list/?page=${page}`)
      } catch (e) {}
    }
    const text = await res.text()
    const $ = load(text)
    const ids = []
    $('.film_list-wrap > div.flw-item').each((i, el) => {
      ids.push($(el).find('div:nth-child(1) > a.film-poster-ahref').attr('href').slice(1))
    })
    hasNextPage = ids.length === 36
    episodeData = {}
    yield * ids
    await scheduleSave(page)
    page++
  }
}
for await (const animeID of animeList(1)) {
  const [malId, epData] = await fetchAnimeEpisodeMetadata(animeID)
  console.log(malId, epData)
  episodeData[malId] = epData
}

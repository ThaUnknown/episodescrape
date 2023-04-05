import { readFile, writeFile } from 'node:fs/promises'

const aniskip = JSON.parse(await readFile('./data/aniskip/parsed.json', { encoding: 'utf8' }))
const nanime = JSON.parse(await readFile('./data/9anime/parsers/aniskip.json', { encoding: 'utf8' }))
const zoro = JSON.parse(await readFile('./data/zoro/parsers/aniskip.json', { encoding: 'utf8' }))

for (const [malID, episodes] of Object.entries(nanime)) {
  if (malID === '0') continue
  if (!aniskip[malID]) aniskip[malID] = []
  const anime = aniskip[malID]
  for (const episode of episodes) {
    const found = anime.find(ep => ep.number === episode.number)
    if (!found) {
      const obj = {
        duration: episode.duration,
        number: episode.number
      }
      if (episode.intro) {
        obj.intro = {
          start: episode.intro[0],
          end: episode.intro[1],
          duration: episode.duration
        }
      }
      if (episode.outro) {
        obj.outro = {
          start: episode.outro[0],
          end: episode.outro[1],
          duration: episode.duration
        }
      }
      anime.push(obj)
      continue
    }
    if (episode.intro && !found.intro) {
      found.intro = {
        start: episode.intro.start,
        end: episode.intro.end,
        duration: episode.duration
      }
    }
    if (episode.outro && !found.outro) {
      found.outro = {
        start: episode.outro.start,
        end: episode.outro.end,
        duration: episode.duration
      }
    }
  }
}

for (const [malID, episodes] of Object.entries(zoro)) {
  if (malID === '0') continue
  if (!aniskip[malID]) aniskip[malID] = []
  const anime = aniskip[malID]
  for (const episode of episodes) {
    const found = anime.find(ep => ep.number === episode.number)
    if (!found) {
      const obj = {
        duration: episode.duration,
        number: episode.number
      }
      if (episode.intro) {
        obj.intro = {
          start: episode.intro.start,
          end: episode.intro.end,
          duration: episode.duration
        }
      }
      anime.push(obj)
      continue
    }
    if (episode.intro && !found.intro) {
      found.intro = {
        start: episode.intro.start,
        end: episode.intro.end,
        duration: episode.duration
      }
    }
  }
}

console.log(Object.values(aniskip).reduce((prev, current) => {
  return prev + current.length
}, 0), Object.keys(aniskip).length)

writeFile('./data/compiled/aniskip.json', JSON.stringify(aniskip))

import { readFile, writeFile } from 'node:fs/promises'

const nanime = JSON.parse(await readFile('./data/9anime/parsers/aniskip.json', { encoding: 'utf8' }))
const zoro = JSON.parse(await readFile('./data/zoro/parsers/aniskip.json', { encoding: 'utf8' }))

for (const [malID, episodes] of Object.entries(zoro)) {
  if (malID === '0') continue
  if (!nanime[malID]) nanime[malID] = []
  const anime = nanime[malID]
  for (const episode of episodes) {
    const found = anime.find(ep => ep.number === episode.number)
    if (!found) {
      anime.push({
        duration: episode.duration,
        intro: [episode.intro.start, episode.intro.end],
        number: episode.number
      })
      continue
    } else if (episode.intro && !found.intro) {
      found.intro = [episode.intro.start, episode.intro.end]
    }
  }
}

console.log(Object.values(nanime).reduce((prev, current) => {
  return prev + current.length
}, 0), Object.keys(nanime).length)

writeFile('./data/compiled/non-aniskip.json', JSON.stringify(nanime))

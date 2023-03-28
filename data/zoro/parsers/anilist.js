// parses data for aniskip api
import { readdir, readFile, writeFile } from 'node:fs/promises'

function verifyTitle (title, episode) {
  if (!title) return null
  const lower = title.toLowerCase()
  if (lower === 'full') return null
  if (lower === 'episode ' + episode) return null
  if (lower === 'ova') return null
  if (lower === 'movie') return null
  if (lower === 'ona') return null
  if (lower === 'episode') return null
}

const data = {}

const files = await readdir('./data/zoro/')

for (const file of files) {
  const contents = JSON.parse(await readFile('./data/zoro/' + file, { encoding: 'utf8' }))
  for (const [key, episodes] of Object.entries(contents)) {
    const validEpisodes = []
    for (const { duration, number, intro, title } of episodes) {
      if (duration !== 0 || intro || verifyTitle(title, number)) {
        validEpisodes.push({ duration, number, intro, title })
      }
    }
    if (validEpisodes.length) data[key] = validEpisodes
  }
}
console.log(Object.values(data).reduce((prev, current) => {
  return prev + current.length
}, 0), Object.keys(data).length)
writeFile('./data/zoro/parsers/anilist.json', JSON.stringify(data))

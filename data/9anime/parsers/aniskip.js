// parses data for aniskip api
import { readdir, readFile, writeFile } from 'node:fs/promises'

const data = {}

const files = await readdir('./data/9anime/')

for (const file of files) {
  if (!file.endsWith('.json')) continue
  const contents = JSON.parse(await readFile('./data/9anime/' + file, { encoding: 'utf8' }))
  for (const [key, episodes] of Object.entries(contents)) {
    const validEpisodes = []
    for (const { duration, number, intro, outro } of episodes) {
      if (duration !== 0 && (intro || outro)) {
        validEpisodes.push({ duration, number, intro, outro })
      }
    }
    if (validEpisodes.length) data[key] = validEpisodes
  }
}
console.log(Object.values(data).reduce((prev, current) => {
  return prev + current.length
}, 0), Object.keys(data).length)
writeFile('./data/9anime/parsers/aniskip.json', JSON.stringify(data))

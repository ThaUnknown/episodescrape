// parses data for aniskip api
import { readdir, readFile, writeFile } from 'node:fs/promises'

const data = {}

const files = await readdir('./data/')

for (const file of files) {
  const contents = JSON.parse(await readFile('./data/' + file, { encoding: 'utf8' }))
  for (const [key, episodes] of Object.entries(contents)) {
    const validEpisodes = []
    for (const { duration, number, intro } of episodes) {
      if (duration !== 0 && intro) {
        validEpisodes.push({ duration, number, intro })
      }
    }
    if (validEpisodes.length) data[key] = validEpisodes
  }
}
console.log(Object.values(data).reduce((prev, current) => {
  return prev + current.length
}, 0), Object.keys(data).length)
writeFile('./data/aniskip.json', JSON.stringify(data))

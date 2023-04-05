import { readFile, writeFile } from 'node:fs/promises'

const dump = await readFile('data/aniskip/dump.md')

const episodes = []

for (const line of dump.toString().split('\n')) {
  // eslint-disable-next-line no-tabs
  const [skipHash, malId, eps, client, type, rating, start, end, length, submittedDatestamp, userHash] = line.split('	')
  episodes.push({ rating, malId, eps, type, start, end, length })
}

episodes.sort((a, b) => b - a)

const entries = {}

for (const { rating, malId, eps, type, start, end, length } of episodes) {
  if (!(type === 'op' || type === 'ed')) continue
  if (rating == null || rating < 0) continue
  if (!entries[malId]) entries[malId] = []
  if (!entries[malId][eps]) entries[malId][eps] = { number: eps }
  const customType = type === 'op' ? 'intro' : 'outro'
  if (!entries[malId][eps][customType]) entries[malId][eps][customType] = { start, end, duration: length }
}

for (const [key, value] of Object.entries(entries)) {
  entries[key] = value.filter(e => e)
}

console.log(Object.values(entries).reduce((prev, current) => {
  return prev + current.length
}, 0), Object.keys(entries).length)

await writeFile('data/aniskip/parsed.json', JSON.stringify(entries))

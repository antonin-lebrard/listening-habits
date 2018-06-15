'use strict'

/**
 * @typedef {Object} HabitsPart
 * @property {Number} start
 * @property {Number} end
 */

/**
 * @param {Array.<HabitsPart>} habits
 */
function containsWrongDate(habits) {

  for (let i = 0; i < habits.length; i++) {
    if (habits[i].start < 946080000 || habits[i].end < 946080000) {
      return true
    }
  }

  return false

}

/**
 * @param {Object.<String, Array.<HabitsPart>>} habits
 * @return {Object.<String, Array.<HabitsPart>>}
 */
function filterOutOneTimeArtists(habits) {

  const names = Object.keys(habits)
  for (let i = 0; i < names.length; i++) {
    if (habits[names[i]].length === 1) {
      delete habits[names[i]]
      continue
    }
    if (containsWrongDate(habits[names[i]])) {
      delete habits[names[i]]
      continue
    }
  }

  return habits

}

function mapData(data) {
  const toReturn = []
  const names = Object.keys(data)
  let d
  for (let i = 0; i < names.length; i++) {
    d = { label: names[i], data: [] }
    for (let j = 0; j < data[names[i]].length; j++) {
      d.data.push({
        timeRange: [
          new Date(data[names[i]][j].start * 1000),
          new Date(data[names[i]][j].end * 1000)
        ],
        val: data[names[i]][j].end - data[names[i]][j].start
      })
    }
    toReturn.push(d)
  }
  return [ { group: '', data: toReturn } ]
}
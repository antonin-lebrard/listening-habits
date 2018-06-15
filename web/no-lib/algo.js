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
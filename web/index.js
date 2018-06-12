'use strict'

const chartEl = document.getElementById('chart');
const timelineEl = document.getElementById('timeline')

const timeline = new TimelineChart(timelineEl)

function dispaySmt() {
  fetchArtistsHabits(artistHabits => {
    filterOutOneTimeArtists(artistHabits)
    timeline.drawData(artistHabits)
  })
}
dispaySmt()


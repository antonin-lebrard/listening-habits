'use strict'

let chart, y = 0, maxy = 0
const timelineEl = document.getElementById('timeline')
let svg
let g

function displaySmt() {
  fetchArtistsHabits(artistHabits => {
    filterOutOneTimeArtists(artistHabits)
    chart = TimelinesChart()
    chart
      .maxHeight(window.innerHeight - 50)
      .data(mapData(artistHabits))
      .zQualitative(false)
      (timelineEl)
    maxy = chart.getTotalNLines()
    setUp()
  })
}
displaySmt()

function setUp() {
  svg = timelineEl.children[0]
  g = svg.children[3]
  Object.defineProperty(g, 'y', {
    get: () => g.getClientRects()[0].y
  })
  Object.defineProperty(g, 'x', {
    get: () => g.getClientRects()[0].x
  })
  Object.defineProperty(g, 'w', {
    get: () => Math.floor(g.getClientRects()[0].width)
  })
  Object.defineProperty(g, 'h', {
    get: () => Math.floor(g.getClientRects()[0].height)
  })
  setUpEventListeners()
}

function setUpEventListeners() {
  // wheel event => zoom
  const origZX = chart.zoomX()
  const origZY = [0, chart.getTotalNLines()]
  g.addEventListener('wheel', (ev) => {
    const { x, y } = ev

    const tx = x - g.x
    const ty = y - g.y
    const maxX = g.w
    const maxY = g.h

    let zoomFactor = 1

    let newZX, newZY

    const lzx = chart.zoomX().map(el => el.valueOf())
    let lzy = chart.zoomY()
    if (lzy[0] === null) lzy = [0, chart.getTotalNLines()]

    const xmidInZ = ((lzx[1] - lzx[0]) * (tx / maxX)) + lzx[0]
    const ymidInZ = ((lzy[1] - lzy[0]) * (ty / maxY)) + lzy[0]

    if (ev.wheelDeltaY > 0) {
      zoomFactor = 0.5

      const cxl = Math.ceil(((xmidInZ - lzx[0]) * zoomFactor) + lzx[0])
      const cxr = Math.floor(((lzx[1] - xmidInZ) * zoomFactor) + xmidInZ)
      const cyu = Math.ceil(((ymidInZ - lzy[0]) * zoomFactor) + lzy[0])
      const cyb = Math.floor(((lzy[1] - ymidInZ) * zoomFactor) + ymidInZ)

      newZX = [new Date(cxl), new Date(cxr)]
      newZY = [cyu, cyb]
    }
    else {
      zoomFactor = 2

      const cxl = Math.ceil(xmidInZ - ((xmidInZ - lzx[0]) * zoomFactor))
      const cxr = Math.floor(((lzx[1] - xmidInZ) * zoomFactor) + xmidInZ)
      const cyu = Math.ceil(ymidInZ - ((ymidInZ - lzy[0]) * zoomFactor))
      const cyb = Math.floor(((lzy[1] - ymidInZ) * zoomFactor) + ymidInZ)

      newZX = [new Date(cxl), new Date(cxr)]
      newZY = [cyu, cyb]
    }

    if (newZX[0] < origZX[0]) newZX[0] = origZX[0]
    if (newZX[1] > origZX[1]) newZX[1] = origZX[1]
    if (newZY[0] < origZY[0]) newZY[0] = origZY[0]
    if (newZY[1] > origZY[1]) newZY[1] = origZY[1]

    while(newZY[1] - newZY[0] < 20) {
      newZY[0]--
      newZY[1]++
    }
    while(newZX[1].valueOf() - newZX[0].valueOf() < 30 * 24 * 60 * 60 * 1000) {
      newZX[0] = new Date(newZX[0].valueOf() - 24 * 60 * 60 * 1000)
      newZX[1] = new Date(newZX[1].valueOf() + 24 * 60 * 60 * 1000)
    }

    const zoom = new Event('zoom')

    zoom.detail = {
      zoomX: newZX,
      zoomY: newZY,
      redraw: true
    }

    svg.dispatchEvent(zoom)
  })

  let curX, curY
  g.addEventListener('mousedown', (ev) => {
    const { x, y } = ev
    const tx = x - g.x
    const ty = y - g.y
    curX = tx
    curY = ty
  })
  g.addEventListener('mouseup', (ev) => {
    const { x, y } = ev
    const tx = x - g.x
    const ty = y - g.y
    const maxX = g.w
    const maxY = g.h

    const dx = curX - tx
    const dy = curY - ty
    if (dx === 0 && dy === 0) return

    let newZX, newZY

    const lzx = chart.zoomX().map(el => el.valueOf())
    let lzy = chart.zoomY()
    if (lzy[0] === null) lzy = [0, chart.getTotalNLines()]

    const dxInZ = ((lzx[1] - lzx[0]) * (dx / maxX))
    const dyInZ = ((lzy[1] - lzy[0]) * (dy / maxY))

    newZX = [new Date(lzx[0] + dxInZ), new Date(lzx[1] + dxInZ)]
    newZY = [lzy[0] + dyInZ, lzy[1] + dyInZ]

    if (newZX[0] < origZX[0]) newZX[0] = origZX[0]
    if (newZX[1] > origZX[1]) newZX[1] = origZX[1]
    if (newZY[0] < origZY[0]) newZY[0] = origZY[0]
    if (newZY[1] > origZY[1]) newZY[1] = origZY[1]

    const zoom = new Event('zoom')

    zoom.detail = {
      zoomX: newZX,
      zoomY: newZY,
      redraw: true
    }

    svg.dispatchEvent(zoom)

    curX = undefined
    curY = undefined
  })
}

function hDay(noDay, lang) {
  switch (lang) {
    case 'fr':
      switch (noDay) {
        case 0: return 'Lundi'
        case 1: return 'Mardi'
        case 2: return 'Mercredi'
        case 3: return 'Jeudi'
        case 4: return 'Vendredi'
        case 5: return 'Samedi'
        case 6: return 'Dimanche'
      }
    default:
      switch (noDay) {
        case 0: return 'Monday'
        case 1: return 'Tuesday'
        case 2: return 'Wednesday'
        case 3: return 'Thursday'
        case 4: return 'Friday'
        case 5: return 'Saturday'
        case 6: return 'Sunday'
      }
  }
}

function hMonth(noMonth, lang) {
  switch (lang) {
    case 'fr':
      switch (noMonth) {
        case 0: return 'Janvier'
        case 1: return 'Fevrier'
        case 2: return 'Mars'
        case 3: return 'Avril'
        case 4: return 'Mai'
        case 5: return 'Juin'
        case 6: return 'Juillet'
        case 7: return 'Août'
        case 8: return 'Septembre'
        case 9: return 'Octobre'
        case 10: return 'Novembre'
        case 11: return 'Décembre'
      }
    default:
      switch (noMonth) {
        case 0: return 'January'
        case 1: return 'February'
        case 2: return 'March'
        case 3: return 'April'
        case 4: return 'May'
        case 5: return 'June'
        case 6: return 'July'
        case 7: return 'August'
        case 8: return 'September'
        case 9: return 'October'
        case 10: return 'November'
        case 11: return 'December'
      }
  }
}

function hTime(hour) {
  if (hour < 10) return `0${hour}`
  return `${hour}`
}

class TimelineChart {

  constructor(el) {
    this.el = el
    this.artistsColumn = document.createElement('div')
    this.artistsColumn.id = 'artistsColumn'
    this.timelineColumn = document.createElement('div')
    this.timelineColumn.id = 'timelineColumn'
    this.detailsEl = document.createElement('div')
    this.detailsEl.id = 'details'
    this.detailsHidingTimer = undefined
    this.el.appendChild(this.detailsEl)
    this.el.appendChild(this.artistsColumn)
    this.el.appendChild(this.timelineColumn)
    this.artistEls = []
    this.timelineEls = []
    this.totalMarginLeft = []
    this.ratio = 1
    let resizeTimer
    window.addEventListener('resize', () => {
      if (resizeTimer)
        clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        this.artistsColumn.innerHTML = ''
        this.timelineColumn.innerHTML = ''
        this.artistEls = []
        this.timelineEls = []
        this.totalMarginLeft = []
        this.drawData(this.data)
      }, 200)
    })
    //cursor coordinates
    let cursorX = 0, cursorY = 0, mouseDown = false, xPos = 0, yPos = 0

    this.timelineColumn.addEventListener('mousemove', function(e) {
      e.preventDefault()

      cursorX = e.clientX
      cursorY = e.clientY

      if (mouseDown) {
        window.scrollTo(
          document.body.scrollLeft + (xPos - e.clientX),
          document.body.scrollTop + (yPos - e.clientY)
        )
      }
    })

    this.timelineColumn.addEventListener('mousedown', function(e) {
      e.preventDefault()
      if (e.button === 0) {
        xPos = e.pageX
        yPos = e.pageY
        mouseDown = true
      }
    })

    window.addEventListener('mouseup', function(e) {
      e.preventDefault()
      mouseDown = false
    })
  }

  drawData(data) {
    this.data = data
    this._computeDataBounds(data)
    const names = Object.keys(data)
    names.splice(0, 0, 'Legend:')
    data['Legend:'] = this._legendTimespans()
    for (let i = 0; i < names.length; i++) {
      this._addArtist(names[i])
      this._prepareTimespans()

      data[names[i]].sort((one, other) => one.start - other.start)

      for (let j = 0; j < data[names[i]].length; j++) {
        const h = data[names[i]][j]
        this._drawTimespan(h, i)
      }
    }
  }

  _computeDataBounds(data) {
    let minTime = Infinity,
      maxTime = -Infinity
    const names = Object.keys(data)
    for (let i = 0; i < names.length; i++) {
      for (let j = 0; j < data[names[i]].length; j++) {
        if (data[names[i]][j].start < minTime)
          minTime = data[names[i]][j].start
        if (data[names[i]][j].end > maxTime)
          maxTime = data[names[i]][j].end
      }
    }
    this.minTime = minTime
    this.maxTime = maxTime
    this.ratio = (maxTime - minTime) / (window.innerWidth - 250)
    document.body.style.width = `${Math.ceil(((maxTime - minTime) / this.ratio)) + 200}px`
  }

  _legendTimespans() {
    const oneHour = 60 * 60
    const oneDay = oneHour * 24
    const oneWeek = oneDay * 7
    const oneMonth = oneDay * 31
    const oneYear = oneDay * 365
    const toReturn = []
    if (this.maxTime - this.minTime > oneYear) {
      const minYear = Math.ceil(this.minTime / oneYear) + 1970
      const maxYear = Math.floor(this.maxTime / oneYear) + 1970
      for (let i = minYear; i <= maxYear; i++) {
        toReturn.push({
          start: (new Date(0)).setUTCFullYear(i) / 1000,
          end: (new Date(0)).setUTCFullYear(i) / 1000,
          label: i
        })
      }
    }
    return toReturn
  }

  _addArtist(name) {
    const div = document.createElement('div')
    div.classList.add('artistDiv')
    div.innerText = name
    this.artistsColumn.appendChild(div)
    this.artistEls.push(div)
  }

  _prepareTimespans() {
    const div = document.createElement('div')
    div.classList.add('timelineDiv')
    this.timelineColumn.appendChild(div)
    this.timelineEls.push(div)
    this.totalMarginLeft.push(0)
  }

  _drawTimespan({start: from, end: to, label}, rowIdx) {
    const f = Math.floor(((from - this.minTime) / this.ratio))
    const t = Math.ceil(((to - this.minTime) / this.ratio))

    const div = document.createElement('div')
    div.style.width = `${t - f}px`
    const marginLeft = f - this.totalMarginLeft[rowIdx]
    div.style.marginLeft = `${marginLeft}px`
    //div.style.left = `${f}px`
    div.classList.add('timespanDiv')

    div.setAttribute('from', this._humanDate(from))
    div.setAttribute('to', this._humanDate(to, from))

    this.timelineEls[rowIdx].appendChild(div)
    this.totalMarginLeft[rowIdx] += marginLeft

    if (label) {
      const labelDiv = document.createElement('div')
      labelDiv.innerText = label
      labelDiv.style.left = `${f + 5}px`
      labelDiv.classList.add('timespanLabel')
      this.timelineEls[rowIdx].appendChild(labelDiv)
    }

    div.addEventListener('click', () => {
      this.detailsEl.innerHTML =
        `<b>From</b> ${div.getAttribute('from')} <b>to</b> ${div.getAttribute('to')}`
      this.detailsEl.style.display = 'inherit'
      if (this.detailsHidingTimer)
        clearTimeout(this.detailsHidingTimer)
      this.detailsHidingTimer = setTimeout(() => {
        this.detailsEl.style.display = 'none'
      }, 5000)
    })
  }

  _humanDate(ts, relativeTs) {
    const date = new Date(ts * 1000)
    const day = hDay(date.getDay(), navigator.language)
    const no = date.getDate()
    const month = hMonth(date.getMonth(), navigator.language)
    const year = date.getFullYear()
    const hour = hTime(date.getHours())
    const min = hTime(date.getMinutes())
    if (!relativeTs)
      return `${day} ${no} ${month} ${year}, ${hour}:${min}`
    else {
      const otherDate = new Date(relativeTs * 1000)
      const otherDay = hDay(otherDate.getDay(), navigator.language)
      const otherNo = otherDate.getDate()
      const otherMonth = hMonth(otherDate.getMonth(), navigator.language)
      const otherYear = otherDate.getFullYear()
      if (year !== otherYear)
        return `${day} ${no} ${month} ${year}, ${hour}:${min}`
      if (month !== otherMonth)
        return `${day} ${no} ${month}, ${hour}:${min}`
      if (no !== otherNo || day !== otherDay)
        return `${day} ${no}, ${hour}:${min}`
      return `${hour}:${min}`
    }
  }

}


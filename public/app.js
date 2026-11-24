const byId = id => document.getElementById(id)
const dimensions = ['system', 'type', 'faction', 'orderStatus']
const formatDate = value => new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
}).format(new Date(value))

function element(tag, text, className) {
  const node = document.createElement(tag)
  if (text !== undefined) node.textContent = text
  if (className) node.className = className
  return node
}

async function readFile(path) {
  const response = await fetch('./data/' + path)
  if (!response.ok) throw new Error(path)
  return response.json()
}

function drawChart(rows, field, previewDates) {
  const counts = new Map(field === 'date' ? previewDates.map(date => [date, 0]) : [])
  for (const row of rows) counts.set(row[field], (counts.get(row[field]) ?? 0) + 1)
  const groups = [...counts].sort(([a, n], [b, m]) =>
    field === 'date' ? a.localeCompare(b) : m - n || a.localeCompare(b))
  const largest = Math.max(1, ...counts.values())
  const bars = groups.map(([label, count]) => {
    const row = element('div', undefined, 'bar-row')
    const track = element('div', undefined, 'track')
    const bar = element('div', undefined, 'bar')
    bar.style.width = (100 * count / largest) + '%'
    track.append(bar)
    row.append(element('span', field === 'date' ? formatDate(label) : label), track, element('b', count))
    return row
  })
  byId('chart').replaceChildren(...bars)
}

const monthLabel = new Intl.DateTimeFormat('en-GB', {month: 'short', timeZone: 'UTC'})

const palette = ['#23745a', '#d08a32', '#447cb0', '#995777', '#64aab0', '#7466a4', '#9d9b43', '#ba6047', '#39898e', '#ab824f', '#577aaa', '#8f644b']

function showMonthTooltip(segment, x, y) {
  const tip = byId('month-tooltip')
  tip.textContent = segment.getAttribute('aria-label')
  tip.hidden = false
  tip.style.left = Math.max(8, Math.min(x + 12, document.documentElement.clientWidth - tip.offsetWidth - 8)) + 'px'
  const below = y + 14
  tip.style.top = (below + tip.offsetHeight < window.innerHeight ? below : Math.max(8, y - tip.offsetHeight - 10)) + 'px'
}

function hideMonthTooltip() {
  byId('month-tooltip').hidden = true
}

function drawMonthlyCharts(rows, start, end, field, series, hidden) {
  const container = byId('monthly-charts')
  hideMonthTooltip()
  container.replaceChildren()
  if (start > end) {
    container.textContent = 'No preview dates in this range.'
    return
  }
  const months = new Map()
  const cursor = new Date(start + '-01T00:00:00Z')
  while (cursor.toISOString().slice(0, 7) <= end) {
    months.set(cursor.toISOString().slice(0, 7), {counts: new Map(), total: 0})
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  for (const row of rows) {
    const month = months.get(row.date.slice(0, 7))
    const label = row[field]
    month.counts.set(label, (month.counts.get(label) || 0) + 1)
    month.total++
  }
  const largest = Math.max(1, ...Array.from(months.values(), m => m.total))
  const years = new Map()
  for (const [month, {counts}] of months) {
    const year = month.slice(0, 4)
    if (!years.has(year)) {
      const figure = element('figure')
      const columns = element('ol', undefined, 'month-columns')
      figure.append(element('figcaption', year), columns)
      container.append(figure)
      years.set(year, columns)
    }
    const column = element('li')
    column.style.gridColumn = Number(month.slice(5))
    const plot = element('div', undefined, 'month-plot')
    let visible = 0
    const segments = []
    for (const [label, color] of series) {
      const count = counts.get(label)
      if (!count || hidden.has(label)) continue
      visible += count
      const bar = element('span', undefined, 'month-bar')
      bar.style.height = (100 * count / largest) + '%'
      bar.style.backgroundColor = color
      bar.setAttribute('role', 'img')
      bar.setAttribute('aria-label', label + ' · ' + count + (count === 1 ? ' offering' : ' offerings'))
      bar.tabIndex = 0
      bar.onpointerenter = bar.onpointermove = event => showMonthTooltip(bar, event.clientX, event.clientY)
      bar.onpointerleave = bar.onblur = hideMonthTooltip
      bar.onfocus = () => {
        const rect = bar.getBoundingClientRect()
        showMonthTooltip(bar, rect.right, rect.top)
      }
      bar.onkeydown = event => { if (event.key === 'Escape') hideMonthTooltip() }
      segments.push(bar)
    }
    plot.append(element('b', visible), ...segments.reverse())
    column.append(plot, monthLabel.format(new Date(month + '-01')))
    years.get(year).append(column)
  }
}

async function start() {
  const files = await readFile('index.json')
  const posts = []
  for (let offset = 0; offset < files.length; offset += 6) {
    const batch = files.slice(offset, offset + 6)
    posts.push(...await Promise.all(batch.map(readFile)))
  }
  posts.sort((a, b) => a.date.localeCompare(b.date))
  const all = posts.flatMap(post => post.items.map(item => ({
    ...item, date: post.date,
    orderStatus: item.madeToOrder === true ? 'Made to Order' : 'Not identified as Made to Order'
  })))
  const systemRows = all.flatMap(row => [...new Set(row.applicableSystems || [row.system])]
    .map(system => ({...row, system})))
  const first = posts[0].date
  const last = posts.at(-1).date
  const colors = new Map()
  const hidden = new Map()
  for (const key of [...dimensions, 'date']) {
    const source = key === 'system' ? systemRows : all
    const labels = [...new Set(source.map(row => row[key]))].sort()
    colors.set(key, new Map(labels.map((label, i) => [label, palette[i] || ('hsl(' + (i * 137.508 % 360) + ' 48% 45%)')])))
    hidden.set(key, new Set())
  }
  const monthYear = new Intl.DateTimeFormat('en-GB', {month: 'short', year: 'numeric', timeZone: 'UTC'})
  byId('coverage').textContent = monthYear.format(new Date(first)) + ' – ' + monthYear.format(new Date(last))
  for (const key of dimensions) {
    const labels = colors.get(key).keys()
    const prompts = {system: 'All systems', type: 'All release types', faction: 'All factions', orderStatus: 'All order statuses'}
    byId(key).add(new Option(prompts[key], ''))
    for (const label of labels) byId(key).add(new Option(label, label))
  }
  const firstMonth = first.slice(0, 7)
  const lastMonth = last.slice(0, 7)
  const fullMonth = new Intl.DateTimeFormat('en-GB', {month: 'long', year: 'numeric', timeZone: 'UTC'})
  const cursor = new Date(firstMonth + '-01T00:00:00Z')
  while (cursor.toISOString().slice(0, 7) <= lastMonth) {
    const value = cursor.toISOString().slice(0, 7)
    const label = fullMonth.format(cursor)
    byId('from').add(new Option(label, value, value === firstMonth, value === firstMonth))
    byId('through').add(new Option(label, value, value === lastMonth, value === lastMonth))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  function render() {
    const from = byId('from').value
    const through = byId('through').value
    const system = byId('system').value
    const includeMto = byId('include-mto').checked
    byId('monthly-include-mto').checked = includeMto
    function inMonthRange(date) {
      const month = date.slice(0, 7)
      return month >= from && month <= through
    }
    function matchesFilters(row) {
      return ['type', 'faction', 'orderStatus'].every(key => !byId(key).value || row[key] === byId(key).value)
        && (includeMto || !row.madeToOrder)
        && inMonthRange(row.date)
    }
    const rows = all.filter(row => (!system || (row.applicableSystems || [row.system]).includes(system)) && matchesFilters(row))
    const memberships = systemRows.filter(row => (!system || row.system === system) && matchesFilters(row))
    const group = byId('group')
    byId('chart-title').textContent = 'Releases by ' + group.selectedOptions[0].text.toLowerCase()
    byId('total').textContent = rows.length + ' product offering' + (rows.length === 1 ? '' : 's')
    const previewDates = posts.map(post => post.date)
      .filter(inMonthRange)
    drawChart(group.value === 'system' ? memberships : rows, group.value, previewDates)
    const field = byId('monthly-group').value
    const monthlyRows = field === 'system' ? memberships : rows
    const available = new Set(monthlyRows.map(row => row[field]))
    const series = [...colors.get(field)].filter(([label]) => available.has(label))
    const excluded = hidden.get(field)
    function updateMonthly() {
      drawMonthlyCharts(monthlyRows, from, through, field, series, excluded)
    }
    const toggles = series.map(([label, color]) => {
      const choice = element('label')
      const input = element('input')
      input.type = 'checkbox'
      input.checked = !excluded.has(label)
      choice.style.setProperty('--series-color', color)
      input.onchange = () => {
        if (input.checked) excluded.delete(label)
        else excluded.add(label)
        updateMonthly()
      }
      choice.append(input, field === 'date' ? formatDate(label) : label)
      return choice
    })
    byId('series-legend').replaceChildren(...toggles)
    byId('show-series').onclick = () => { excluded.clear(); render() }
    byId('hide-series').onclick = () => { for (const [label] of series) excluded.add(label); render() }
    updateMonthly()
    if (!rows.length) byId('chart').textContent = from && through && from > through
      ? 'Choose an end month on or after the start month.' : 'No offerings match these filters.'
  }
  byId('filters').addEventListener('input', render)
  byId('filters').addEventListener('reset', () => requestAnimationFrame(render))
  byId('group').addEventListener('change', render)
  byId('monthly-include-mto').addEventListener('change', event => {
    byId('include-mto').checked = event.target.checked
    render()
  })
  byId('monthly-group').addEventListener('change', render)
  render()
}

start().catch(() => {
  byId('coverage').textContent = 'Unavailable'
  byId('total').textContent = 'The release data could not be loaded. Refresh to try again.'
})

export class DmDataTable<
  T extends { id?: string; 'content-type'?: string } & Record<string, unknown> = Record<string, unknown>
> extends HTMLTableElement {
  static get observedAttributes() {
    return ['columns']
  }

  columns: string[] = []
  src = '/'
  eventSource?: EventSource

  connectedCallback() {
    if (!this.isConnected) return
    this.load()
    this.connect()
  }
  disconnectedCallback() {
    this.disconnect()
  }
  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === 'columns') {
      this.columns = newValue.split(',').map((v) => v.trim())
    }
  }

  async load() {
    const res = await fetch('/', { headers: { Accept: 'application/json' } })
    const items = await res.json()
    for (const item of items) this.prependItem(item)
  }

  async connect() {
    const es = new EventSource(this.src)
    const promise = new Promise((resolve, reject) => {
      es.onopen = resolve
      es.onerror = reject
    })
    es.onmessage = (ev) => {
      const item = JSON.parse(ev.data)
      const row = this.rows.namedItem('item-' + item.id)
      if (row) row.remove()
      this.prependItem(item)
    }
    return promise
  }

  async disconnect() {
    this.eventSource?.close()
  }

  prependItem(item: T) {
    const tr = this.tBodies[0].insertRow(0)
    if (item.id) tr.id = 'item-' + item.id
    const td = tr.insertCell()
    if (item.id && item['content-type']?.startsWith('image/')) {
      const img = document.createElement('img')
      img.src = item.id
      td.append(img)
    }
    for (const column of this.columns) {
      const td = tr.insertCell()
      td.textContent = item[column] as string
    }
    if (item.id) {
      const id = item.id
      const edit = document.createElement('button')
      edit.textContent = '編集'
      edit.onclick = () => this.editItem(id, item, tr)
      tr.append(edit)
    }
  }

  editItem(id: string, item: T, row: HTMLTableRowElement) {
    const children = [...row.children]
    for (const child of Array.from(row.children).slice(1)) child.remove()
    const inputs = new Map()
    for (const column of this.columns) {
      const td = document.createElement('td')
      const input = document.createElement('input')
      input.value = (item[column] as string) || ''
      td.append(input)
      row.append(td)
      inputs.set(column, input)
    }
    const submit = document.createElement('button')
    submit.textContent = '送信'
    submit.onclick = () => {
      const values = Object.fromEntries(Array.from(inputs).map(([k, v]) => [k, v.value]))
      fetch(id, { method: 'PUT', body: JSON.stringify(values), headers: { 'Content-Type': 'application/json' } })
    }
    const cancel = document.createElement('button')
    cancel.textContent = 'キャンセル'
    cancel.onclick = () => row.replaceChildren(...children)
    row.append(submit, cancel)
  }
}

customElements.define('dm-data-table', DmDataTable, { extends: 'table' })

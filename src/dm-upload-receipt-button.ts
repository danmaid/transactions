export class DmUploadReceiptButton extends HTMLElement {
  file: HTMLInputElement
  button: HTMLButtonElement

  constructor() {
    super()
    const root = this.attachShadow({ mode: 'open' })
    root.innerHTML = `
        <input type="file" id="file" accept="image/*,.pdf" multiple style="display: none" />
        <button id="button">レシート/領収書</button>
      `
    const file = root.getElementById('file') as HTMLInputElement
    const button = root.getElementById('button') as HTMLButtonElement
    if (!file || !button) throw Error('invalid children')
    file.onchange = this.onchange
    button.onclick = () => file.click()
    this.file = file
    this.button = button
  }

  onchange = () => {
    for (const file of this.file.files as unknown as File[]) {
      fetch('/receipts', { method: 'POST', body: file })
    }
  }
}

customElements.define('dm-upload-receipt-button', DmUploadReceiptButton)

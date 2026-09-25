import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import WaTextarea from "@awesome.me/webawesome/dist/components/textarea/textarea.js";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { TEXT } from "#constants";

declare global {
  interface HTMLElementTagNameMap {
    "md-file-area": FileAreaElement;
  }

  interface HTMLElementEventMap {
    "markdown-change": CustomEvent<string>;
  }
}

/** Takes a Markdown file by drop, picker, or typing, and shows its text. */
@customElement("md-file-area")
export class FileAreaElement extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--wa-space-s);
    }

    .heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: var(--wa-font-weight-semibold);
    }

    wa-textarea::part(textarea) {
      font-family: var(--wa-font-family-code);
      font-size: var(--wa-font-size-s);
    }

    .dragging wa-textarea {
      outline: var(--wa-border-width-m) dashed var(--wa-color-brand-border-loud);
      outline-offset: var(--wa-space-2xs);
      border-radius: var(--wa-border-radius-m);
    }
  `;

  /** The file's current text. */
  @property({ attribute: false })
  accessor markdown: string = "";

  @state()
  accessor #isDragging: boolean = false;

  override render(): TemplateResult {
    const dropClass = this.#isDragging ? "drop dragging" : "drop";
    return html`
      <div class="heading">
        <span>${TEXT.fileLabel}</span>
        <wa-button size="s" appearance="outlined" @click=${this.#openFile}>
          <wa-icon slot="start" name="folder2-open"></wa-icon>
          ${TEXT.openFile}
        </wa-button>
      </div>
      <div
        class=${dropClass}
        @dragover=${this.#onDragOver}
        @dragleave=${this.#onDragLeave}
        @drop=${this.#onDrop}
      >
        <wa-textarea
          rows="12"
          resize="vertical"
          placeholder=${TEXT.filePlaceholder}
          .value=${this.markdown}
          @input=${this.#onInput}
        ></wa-textarea>
      </div>
    `;
  }

  #openFile(): void {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = ".md,.markdown,text/markdown";
    // The picker is a detached one-shot element that is dropped once it
    // answers, so its handler needs no teardown.
    picker.onchange = (): void => {
      const file = picker.files?.[0];
      if (file !== undefined) {
        void this.#readFile(file);
      }
    };
    picker.click();
  }

  #onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.#isDragging = true;
  }

  #onDragLeave(): void {
    this.#isDragging = false;
  }

  #onDrop(event: DragEvent): void {
    event.preventDefault();
    this.#isDragging = false;
    const file = event.dataTransfer?.files[0];
    if (file !== undefined) {
      void this.#readFile(file);
    }
  }

  #onInput(event: Event): void {
    const textarea = event.currentTarget;
    if (textarea instanceof WaTextarea) {
      this.#emit(textarea.value ?? "");
    }
  }

  async #readFile(file: File): Promise<void> {
    this.#emit(await file.text());
  }

  /** Reports the file's new text to the panel that owns it. */
  #emit(markdown: string): void {
    this.dispatchEvent(
      new CustomEvent<string>("markdown-change", { detail: markdown }),
    );
  }
}

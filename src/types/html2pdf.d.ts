declare module "html2pdf.js" {
  interface Html2PdfOptions {
    margin?: number | [number, number, number, number];
    filename?: string;
    image?: {
      type?: string;
      quality?: number;
    };
    enableLinks?: boolean;
    html2canvas?: any;
    jsPDF?: any;
  }

  interface Html2PdfInstance {
    from(element: HTMLElement): Html2PdfInstance;
    set(options: Html2PdfOptions): Html2PdfInstance;
    save(filename?: string): Promise<void>;
    outputPdf(): Promise<Blob>;
    toPdf(): Promise<Blob>;
    toImg(): Promise<string>;
    toCanvas(): Promise<HTMLCanvasElement>;
  }

  function html2pdf(): Html2PdfInstance;
  function html2pdf(
    element: HTMLElement,
    options?: Html2PdfOptions
  ): Html2PdfInstance;

  export = html2pdf;
}

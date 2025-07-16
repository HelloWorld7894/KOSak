import Alpine from 'alpinejs'
import { PDFDocument, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

// AlpineJS init
declare global {
    interface Window {
        Alpine:any;
    }
}

window.Alpine = Alpine
Alpine.start()

//PDF.js init
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

// some things outside of AlpineJS
var pdf_document: PDFDocument; // global variable for loaded PDFs

// uploading document
document.getElementById("schedule-upload")?.addEventListener("click", async (event: PointerEvent) => {
    let file_list: FileList = (<HTMLInputElement>document.getElementById("schedule-input")).files!;

    let file = file_list[0];
    let array_buffer = await file.arrayBuffer();

    pdf_document = await PDFDocument.load(array_buffer)
    
    // pdf document rendering
    //let page: PDFPage = pdf_document.getPages()[0];
    let pdf_bytes = await pdf_document.save()
    const loading_task = pdfjsLib.getDocument({ data: pdf_bytes })
    loading_task.promise.then((pdf: pdfjsLib.PDFDocumentProxy) => {
        pdf.getPage(1).then((page: pdfjsLib.PDFPageProxy) => {
            let viewport = page.getViewport({scale: 7})

            let canvas = <HTMLCanvasElement>document.getElementById("schedule-canvas");
            let context = canvas.getContext("2d")!;
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            page.render({
                canvasContext: context,
                viewport
            })

            // hide canvas mask
            document.getElementById("canvas-mask")!.setAttribute("hidden", "")
        })
    })
})

// modifying document
document.getElementById("add-schedule")?.addEventListener("click", (event: PointerEvent) => {
    let day = document.querySelector("button[selected]")!.id
    let place: string = (document.getElementById("place") as HTMLInputElement)!.value
    let name: string = (document.getElementById("name") as HTMLInputElement)!.value
    let time_start: string = (document.getElementById("start-time") as HTMLInputElement)!.value
    let time_end: string = (document.getElementById("end-time") as HTMLInputElement)!.value

    console.log(day, place, name, time_start, time_end)
})

// saving modified document
document.getElementById("save-modified-schedule")?.addEventListener("click", async (event: PointerEvent) => {
    const pdf_bytes = await pdf_document.save();
    const blob = new Blob([pdf_bytes as BlobPart], { type: 'application/pdf' });

    let url = URL.createObjectURL(blob)
    
    let link_button: HTMLAnchorElement = document.getElementById("schedule-download")! as HTMLAnchorElement;
    link_button.download = "rozvrh_updated.pdf";
    link_button.href = url
})
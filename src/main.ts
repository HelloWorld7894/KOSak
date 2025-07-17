import Alpine from 'alpinejs'
import { PDFDocument, PDFFont, PDFPage, rgb, scale } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

// fonts
import RobotoRegular from "./res/font/Roboto-Regular.ttf"
import RobotoBold from "./res/font/Roboto-Bold.ttf"

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
var pdf_font_regular: PDFFont;
var pdf_font_bold: PDFFont;

var pdf_scale: number = 7;
var schedule_vert_sep: number[] = []

// uploading document
document.getElementById("schedule-upload")?.addEventListener("click", async (event: PointerEvent) => {
    let file_list: FileList = (<HTMLInputElement>document.getElementById("schedule-input")).files!;

    let file = file_list[0];
    let array_buffer = await file.arrayBuffer();

    pdf_document = await PDFDocument.load(array_buffer)

    // setting right font + fontkit
    pdf_document.registerFontkit(fontkit);
    let roboto_regular_buffer = await fetch(RobotoRegular).then((res) => res.arrayBuffer());
    pdf_font_regular = await pdf_document.embedFont(roboto_regular_buffer);

    let roboto_bold_buffer = await fetch(RobotoBold).then((res) => res.arrayBuffer());
    pdf_font_bold = await pdf_document.embedFont(roboto_bold_buffer);
    
    // pdf document rendering
    await render_schedule()

    // hide canvas mask
    document.getElementById("canvas-mask")!.setAttribute("hidden", "")

    // getting schedule vertical separation
    await get_vertical_separation()

})

// modifying document
document.getElementById("add-schedule")?.addEventListener("click", async (event: PointerEvent) => {
    let day = document.querySelector("button[selected]")!.id
    let place: string = (document.getElementById("place") as HTMLInputElement)!.value
    let name: string = (document.getElementById("name") as HTMLInputElement)!.value
    let time_start: string = (document.getElementById("start-time") as HTMLInputElement)!.value
    let time_end: string = (document.getElementById("end-time") as HTMLInputElement)!.value

    await add_schedule_block(
        day,
        time_start,
        time_end,
        name,
        place
    );
    
    await render_schedule();
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

async function render_schedule(){
    let pdf: pdfjsLib.PDFDocumentProxy = await convert_pdf_lib_to_pdfjs(pdf_document)

    return pdf.getPage(1).then((page: pdfjsLib.PDFPageProxy) => {
        let viewport = page.getViewport({scale: pdf_scale})

        let canvas = <HTMLCanvasElement>document.getElementById("schedule-canvas");
        let context = canvas.getContext("2d")!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        let render_task: pdfjsLib.RenderTask = page.render({
            canvasContext: context,
            viewport
        })

        return render_task.promise;
    })
}

async function convert_pdf_lib_to_pdfjs(pdf_doc: PDFDocument): Promise<pdfjsLib.PDFDocumentProxy>{
    let pdf_bytes = await pdf_doc.save()
    let loading_task = pdfjsLib.getDocument({ data: pdf_bytes })
    return await loading_task.promise;
}

async function add_schedule_block(
    day: string,
    time_start: string,
    time_end: string,
    name: string,
    place: string
){
    const pdf_page: PDFPage = pdf_document.getPages()[0]

    let fontSize = 7;
    //let { width, height } = pdf_page.getSize();

    let width: number = 52;
    let height: number = 49;
    let schedule_top_padding: number = 3

    let black = rgb(0, 0, 0);
    let orange = rgb(1, 0.8, 0.5); // light orange
    let brightOrange = rgb(1, 0.6, 0); // for the left box

    let schedule_coords: number[] = [78, 478];

    switch(parseInt(day)){
        case 1:
            schedule_coords[1] = schedule_vert_sep[0]
            break;
        case 2:
            schedule_coords[1] = schedule_vert_sep[1]
            break;
        case 3:
            schedule_coords[1] = schedule_vert_sep[2]
            break;
        case 4:
            schedule_coords[1] = schedule_vert_sep[3]
            break;
        case 5:
            schedule_coords[1] = schedule_vert_sep[4]
            break;
    }
    schedule_coords[1] -= (height + schedule_top_padding); // align for schedule height

    let schedule_text_v_space: number = 3;
    let schedule_text_h_space: number = 5;

    // main rectangle
    pdf_page.drawRectangle({
        x: schedule_coords[0],
        y: schedule_coords[1],
        width: width,
        height: height,
        color: orange,
    });

    pdf_page.drawRectangle({
        x: schedule_coords[0],
        y: schedule_coords[1],
        width: 2,
        height: height,
        color: brightOrange
    })

    // Time
    pdf_page.drawText(`${time_start} - ${time_end}`, {
        x: schedule_coords[0] + schedule_text_h_space,
        y: schedule_coords[1] + height - fontSize - schedule_text_v_space,
        size: fontSize,
        font: pdf_font_regular,
        color: black,
    });

    // Course code
    pdf_page.drawText(name, {
        x: schedule_coords[0] + schedule_text_h_space,
        y: schedule_coords[1] + height - 2 * (fontSize + schedule_text_v_space),
        size: fontSize,
        font: pdf_font_bold,
        color: black,
    });

    // Instructor
    pdf_page.drawText('Vyučující', {
        x: schedule_coords[0] + schedule_text_h_space,
        y: schedule_coords[1] + height - 3 * (fontSize + schedule_text_v_space),
        size: fontSize,
        font: pdf_font_regular,
        color: black,
    });

    pdf_page.drawText(place, {
        x: schedule_coords[0] + schedule_text_h_space,
        y: schedule_coords[1] + height - 4 * (fontSize + schedule_text_v_space),
        size: fontSize,
        font: pdf_font_regular,
        color: black,
    });
}

async function get_vertical_separation(){
    let vertical_sep = []
    let threshold_color = 155
    let walkon_col = 370
    let on_vert_line: boolean = false

    let canvas = <HTMLCanvasElement>document.getElementById("schedule-canvas")!
    let context: CanvasRenderingContext2D = canvas.getContext("2d")!;

    let data = context.getImageData(0, 0, canvas.width, canvas.height).data;

    for (let y = 0; y < canvas.height; y++){
        let idx = (y * canvas.width + walkon_col) * 4;
        
        let r = data[idx], g = data[idx + 1], b = data[idx + 2];

        if (r == threshold_color && g == threshold_color && b == threshold_color) on_vert_line = true
        else {
            if (on_vert_line) vertical_sep.push([walkon_col, y])
            on_vert_line = false
        }

    }
    for (let i = 0; i < vertical_sep.length; i++){
        let sep_point: number[] = canvas_to_pdf_coords(vertical_sep[i][0], vertical_sep[i][1], canvas.height)
        schedule_vert_sep.push(sep_point[1])
    }

    console.log(schedule_vert_sep)
}

function canvas_to_pdf_coords(x: number, y: number, canvas_height: number){
    let pdf_x = Math.round(x / pdf_scale);
    let pdf_y = Math.round((canvas_height - y) / pdf_scale);
    return [pdf_x, pdf_y]
}
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
var schedule_vert_sep: number[] = [];
var schedule_hor_sep: number[] = [];
var one_hour_space: number = 0;

// uploading document
document.getElementById("schedule-upload")?.addEventListener("click", async (event: PointerEvent) => {
    let file_list: FileList = (<HTMLInputElement>document.getElementById("schedule-input")).files!;

    let file = file_list[0];
    let array_buffer = await file.arrayBuffer();

    pdf_document = await PDFDocument.load(array_buffer)

    // setting right font + fontkit
    await set_fonts()

    // pdf document rendering
    let pdf_bytes = await pdf_document.save()
    await render_schedule(pdf_bytes)

    // hide canvas mask
    document.getElementById("canvas-mask")!.setAttribute("hidden", "")

    // getting schedule vertical separation
    schedule_vert_sep = get_separation("vertical", 10).map(elem => elem[1])
    schedule_vert_sep.splice(0, 1) // TODO: Uaaa i hate it but it works (seems like it detects some debris on canvas or smthing)

    schedule_hor_sep = get_separation("horizontal", 5).map(elem => elem[0])
    one_hour_space = schedule_hor_sep[1] - schedule_hor_sep[0]
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

    let pdf_bytes = await reload_document()
    await render_schedule(pdf_bytes)
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


async function reload_document(){
    // TODO: for some reason I have to reload the document after every change (sucks)

    let pdf_bytes = await pdf_document.save()
    pdf_document = await PDFDocument.load(pdf_bytes)
    set_fonts()

    return pdf_bytes
}

async function set_fonts(){
    pdf_document.registerFontkit(fontkit);
    let roboto_regular_buffer = await fetch(RobotoRegular).then((res) => res.arrayBuffer());
    pdf_font_regular = await pdf_document.embedFont(roboto_regular_buffer);

    let roboto_bold_buffer = await fetch(RobotoBold).then((res) => res.arrayBuffer());
    pdf_font_bold = await pdf_document.embedFont(roboto_bold_buffer);
}


async function render_schedule(pdf_bytes: Uint8Array<ArrayBufferLike>){
    let pdf = await pdfjsLib.getDocument({ data: pdf_bytes }).promise
    
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

function parse_time_to_date(time_str: string){
    const [hours, minutes] = time_str.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0); // hours, minutes, seconds, ms
    return date;
}

function time_difference(time1: string, time2: string){
    let millisecond_diff = new Date(parse_time_to_date(time1)).valueOf() - new Date(parse_time_to_date(time2)).valueOf()
    let hour_diff = millisecond_diff / (1000 * 60 * 60)
    return hour_diff
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

    let height: number = 49;
    let schedule_top_padding: number = 3

    let black = rgb(0, 0, 0);
    let orange = rgb(1, 0.8, 0.5); // light orange
    let brightOrange = rgb(1, 0.6, 0); // for the left box

    let schedule_coords: number[] = [78, 478]; // already set up to top-left portion of schedule

    // positioning vertically
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

    // positioning horizontally
    let hours_schedule_time = time_difference(time_end, time_start)
    let schedule_starting_time = time_difference(time_start, "07:00") // starting time of all CTU lectures

    let width: number = hours_schedule_time * one_hour_space; // getting schedule width
    schedule_coords[0] = schedule_coords[0] + (schedule_starting_time * one_hour_space)

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

    pdf_page.drawText(place, {
        x: schedule_coords[0] + schedule_text_h_space,
        y: schedule_coords[1] + height - 4 * (fontSize + schedule_text_v_space),
        size: fontSize,
        font: pdf_font_regular,
        color: black,
    });
}

function canvas_to_pdf_coords(x: number, y: number, canvas_height: number){
    let pdf_x = Math.round(x / pdf_scale);
    let pdf_y = Math.round((canvas_height - y) / pdf_scale);
    return [pdf_x, pdf_y]
}

function get_separation(type: string, tolerance: number){
    let sep = []
    let pdf_sep = []

    let threshold_color = 155
    let walkon_coords = [370, 470] // [vertical, horizontal]
    let on_line: boolean = false

    let canvas = <HTMLCanvasElement>document.getElementById("schedule-canvas")!
    let context: CanvasRenderingContext2D = canvas.getContext("2d")!;

    let data = context.getImageData(0, 0, canvas.width, canvas.height).data;

    let walkon_func: (iter: number, arg1: number, arg2: number) => number = () => {return 0};
    let iter_max: number = 0; // maximum iteration number
    let walkon_axis: number = 0; // on what axis to do the "walking"
    let out_format: number = -1; // where to place the "walking axis" (either x or y)
    if (type == "vertical"){
        iter_max = canvas.height;
        walkon_axis = walkon_coords[0];
        out_format = 1; 
        walkon_func = (iter_y: number, width: number, col: number) => {return (iter_y * width + col) * 4}; // vertical calculation
    }
    else if (type == "horizontal"){
        iter_max = canvas.width;
        walkon_axis = walkon_coords[1];
        out_format = 0;
        walkon_func = (iter_x: number, width: number, row: number) => {return (row * width + iter_x) * 4}; // horizontal calculation
    }

    for (let i = 0; i < iter_max; i++){
        let idx: number = walkon_func(i, canvas.width, walkon_axis)
        
        const or_op = (color: number) => {return (threshold_color - tolerance >= color) || (threshold_color + tolerance <= color)}

        let r = data[idx], g = data[idx + 1], b = data[idx + 2];
        if (or_op(r) && or_op(g) && or_op(b)) on_line = true
        else {
            if (on_line){
                let out: number[] = [-1, -1]
                out[out_format] = i
                out[Math.abs(out_format - 1)] = walkon_axis

                sep.push(out)
            }
            on_line = false
        }

    }
    for (let i = 0; i < sep.length; i++){
        let sep_pdf_point: number[] = canvas_to_pdf_coords(sep[i][0], sep[i][1], canvas.height)
        pdf_sep.push(sep_pdf_point)
    }

    return pdf_sep
}
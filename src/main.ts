import Alpine from 'alpinejs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'


// AlpineJS init
declare global {
    interface Window {
        Alpine:any;
    }
}


window.Alpine = Alpine
Alpine.start()

document.getElementById("new-schedule")?.addEventListener("click", (event: MouseEvent) => {
    console.log("test")
})
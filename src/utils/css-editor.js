export function addStyleSheet(stylesheetPath, styleSheetID)
{
    var head = document.querySelector("head")
    var stylesheet = document.getElementById("stylesheet-"+styleSheetID)
    if (stylesheet !== null)
        throw "This stylesheet already is present";

    // check stylesheet exists
    if (!window.financeDesktop.stylesheetExists(stylesheetPath)) {
        console.log(`The file or directory at '${sourceFile}' does not exist.`);
        throw "This stylesheet doesn't exists";
    } 


    stylesheet = document.createElement("link")
    stylesheet.setAttribute("rel", "stylesheet")
    stylesheet.setAttribute("href", stylesheetPath)
    stylesheet.setAttribute("id", "stylesheet-"+styleSheetID)
    head.appendChild(stylesheet)
}

export function removeStyleSheet(styleSheetID)
{
    var stylesheet = document.getElementById("stylesheet-"+styleSheetID)
    if (stylesheet === null)
        throw "This stylesheet already does not exists";
    stylesheet.remove()
}

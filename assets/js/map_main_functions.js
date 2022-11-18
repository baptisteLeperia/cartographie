function downloadJSONFile(filename, data)
{
    var blob = new Blob(["map = " + JSON.stringify(data,undefined,2)], {
        type: 'application/json',
        name: filename
    });

    console.log("map = " + JSON.stringify(data,undefined,2));
    /*
    //IE 10+
    if (window.navigator.msSaveBlob)
    {
        window.navigator.msSaveBlob(blob, filename);
    }
    else
    {
        //Everything else
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        document.body.appendChild(a);
        a.href = url;


        a.download = filename;

        setTimeout(() => {
            a.click();

            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 1);
    }
    */
}

function openCanvasWindow(){

    //var canvasWindow = window.open("", "_blank", "toolbar=yes,scrollbars=yes,resizable=yes,width=600,height=600");
    //canvasWindow.document.write("<canvas id=\"imageCanvas\"> </canvas>");
    //var canvas = canvasWindow.document.getElementById("imageCanvas");

    //var canvas = document.createElement('canvas');

    //document.write("<canvas id=\"imageCanvas\"> </canvas>");
    var canvas = document.getElementById("imageCanvas");

    //canvasWindow.close();
    var ctx = canvas.getContext("2d");
    
    ctx.canvas.width = map.w;
    ctx.canvas.height = map.h;

    var copiedCamera = copyCamera();
    camera.zoom = 1;
    focusOnCenterMap();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    photoCanvas = canvas;
    photoCtx = ctx;
    mapCanvas = canvas;
    mapCtx = ctx;

    drawAirPhoto();
    drawElements(false,2);

    /* reinit */
    camera = copiedCamera;
    
    photoCanvas = document.getElementById("photoCanvas");
    photoCtx = photoCanvas.getContext("2d");

    mapCanvas = document.getElementById("mapCanvas");
    mapCtx = mapCanvas.getContext("2d");
    

    refreshSizeCanvas();
    drawMap();

    alert("Click droit puis Enregistrer sous pour enregistrer le plan au format PNG")

    /*
    var url = canvas.toDataURL('image/png');

    var a = document.createElement('a');
    document.body.appendChild(a);
    a.href = url;
    a.download = "Photo_cartographie";

    setTimeout(() => {
        a.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }, 1);
    */
}

function initVariables()
{
    graves = [];
    polygons = [];
    rectangles = [];
    informationElements = [];

    elements = {
        "graves": graves,
        "rectangles": rectangles,
        "polygons": polygons,
        "informationElements": informationElements
    };

    map = {
        "name": null,
        "scale1m": 100.0,
        "init": false,
        "w": null,
        "h": null,
        "displayBackground": true,
        "displayGraveColor": false,
        "displayREC": false,
        "legendWidth": null,
        "elements": elements
    };
}

function initMapSize()
{
    var titleHeight = Math.round(image.width / 10) + map.scale1m;
    map.legendWidth = image.width / 2;
    map.w = image.width + map.legendWidth + map.scale1m;
    map.h = image.height + titleHeight + map.scale1m;
    map.origin = {
        "x": - map.legendWidth,
        "y": - titleHeight - map.scale1m
    };
}

function setMapSize(width, height, center)
{
    map.w = width;
    map.h = height;
    map.origin = {
        "x": center.x - map.w/2,
        "y": center.y - map.h/2
    };
}

// set map scale and do the needed modifications on other variables
function setMapScale(scale)
{
    map.scale1m = scale;
    coeffWidthLine = Math.round(map.scale1m/12);
    selectionDistTolerance = coeffWidthLine;
    updateScaleElement();
}

function getElementIndex(element)
{
    var elementList = elements[element.category];
    return elementList.indexOf(element);
}

function rotateAround(P, center, angle)
{
    return {
        x:center.x+(P.x-center.x)*Math.cos(angle)+(P.y-center.y)*Math.sin(angle),
        y:center.y-(P.x-center.x)*Math.sin(angle)+(P.y-center.y)*Math.cos(angle)
    };
}

function getVector(P1, P2)
{
    var v = {
        x: P2.x - P1.x,
        y: P2.y - P1.y
    };
    return v;
}

function getDeterminant(v1, v2)
{
    return v1.x * v2.y - v1.y * v2.x;
}

function getCenterRect(P, width, height)
{
    var center = {
        x: P.x + width/2,
        y: P.y + height/2
    }
    return center;
}

// P : point to test
// C : rectangle center
function testPointOnRectangle(P, C, width, height, rotation=0)
{
    var P2 = rotateAround(P, C, -rotation);

    return C.x-width/2 <= P2.x && P2.x <= C.x+width/2
        && C.y-height/2 <= P2.y && P2.y <= C.y+height/2;
}

function testPointOnTriangle(P, P1, P2, P3)
{
    v_PP1 = getVector(P, P1);
    v_PP2 = getVector(P, P2);
    v_PP3 = getVector(P, P3);

    det1 = getDeterminant(v_PP1, v_PP2);
    det2 = getDeterminant(v_PP2, v_PP3);
    det3 = getDeterminant(v_PP3, v_PP1);

    // the point P is in the triangle if the 3 determinants have the same sign
    return (det1 <= 0 && det2 <= 0 && det3 <= 0) || (det1 > 0 && det2 > 0 && det3 > 0);
}

function testPointOnElementCategory(P, element, elementCategory)
{
    var functionMapping = {
        graves: testPointIntoGrave,
        polygons: testPointOnPolygon,
        rectangles: testPointOnRectangleElement,
        informationElements: testPointOnInformationElement
    }
    return functionMapping[elementCategory](P, element);
}

function getPointedElement(P)
{
    var result = null;
    for (var elementKey in elements)
    {
        var elementList = elements[elementKey];
        for (var e = elementList.length - 1; e >= 0; --e)
        {
            var element = elementList[e];
            if (testPointOnElementCategory(P, element, elementKey))
            {
                result = element;
                break;
            }
        }
    }
    return result;
}

function testPointOnAllElements(P)
{
    if (getPointedElement(P) == null)
    {
        return false;
    }
    else
    {
        return true;
    }
}

function deselectElement()
{
    if (selectedElement)
    {
        selectedElement.isSelected = false;
        selectedElement = null;
    }
    
}










function onSegment(p,q,r)
{
     if (q.x <= Math.max(p.x, r.x) &&
            q.x >= Math.min(p.x, r.x) &&
            q.y <= Math.max(p.y, r.y) &&
            q.y >= Math.min(p.y, r.y))
        {
            return true;
        }
        return false;
}
 
// To find orientation of ordered triplet (p, q, r).
    // The function returns following values
    // 0 --> p, q and r are collinear
    // 1 --> Clockwise
    // 2 --> Counterclockwise
function orientation(p,q,r)
{
    let val = (q.y - p.y) * (r.x - q.x)
                - (q.x - p.x) * (r.y - q.y);
  
        if (val == 0)
        {
            return 0; // collinear
        }
        return (val > 0) ? 1 : 2; // clock or counterclock wise
}
 
// The function that returns true if
    // line segment 'p1q1' and 'p2q2' intersect.
function  doIntersect(p1,q1,p2,q2)
{
    // Find the four orientations needed for
        // general and special cases
        let o1 = orientation(p1, q1, p2);
        let o2 = orientation(p1, q1, q2);
        let o3 = orientation(p2, q2, p1);
        let o4 = orientation(p2, q2, q1);
  
        // General case
        if (o1 != o2 && o3 != o4)
        {
            return true;
        }
  
        // Special Cases
        // p1, q1 and p2 are collinear and
        // p2 lies on segment p1q1
        if (o1 == 0 && onSegment(p1, p2, q1))
        {
            return true;
        }
  
        // p1, q1 and p2 are collinear and
        // q2 lies on segment p1q1
        if (o2 == 0 && onSegment(p1, q2, q1))
        {
            return true;
        }
  
        // p2, q2 and p1 are collinear and
        // p1 lies on segment p2q2
        if (o3 == 0 && onSegment(p2, p1, q2))
        {
            return true;
        }
  
        // p2, q2 and q1 are collinear and
        // q1 lies on segment p2q2
        if (o4 == 0 && onSegment(p2, q1, q2))
        {
            return true;
        }
  
        // Doesn't fall in any of the above cases
        return false;
}
 
let INF = 100000000;
 
class Point
{
    constructor(x,y)
    {
        this.x = x;
        this.y = y;
    }
}
 

function isInside(polygon,n,p){

    // Create a point for line segment from p to infinite
    let extreme = new Point(INF, p.y);

    // Count intersections of the above line
    // with sides of polygon
    let count = 0, i = 0;
    do
    {
        let next = (i + 1) % n;

        // Check if the line segment from 'p' to
        // 'extreme' intersects with the line
        // segment from 'polygon[i]' to 'polygon[next]'
        if (doIntersect(polygon.pointList[i], polygon.pointList[next], p, extreme))
        {
            // If the point 'p' is collinear with line
            // segment 'i-next', then check if it lies
            // on segment. If it lies, return true, otherwise false
            if (orientation(polygon.pointList[i], p, polygon.pointList[next]) == 0)
            {
                return onSegment(polygon.pointList[i], p,
                                polygon.pointList[next]);
            }

            count++;
        }
        i = next;
    } while (i != 0);

    // Return true if count is odd, false otherwise
    return (count % 2 == 1); // Same as (count%2 == 1)
}

function selectElement(element)
{
    //Trying method to not reselect element
    if (element === selectedElement){
        return;
    }

    deselectElement();
    selectedElement = element;
    element.isSelected = true;
    element.isHovered = false;

    if (element.category=="graves"){
        var jaune="false";
        var rouge="false";
        var danger="false";

        if (element.color==RED_YELLOW){
            rouge="true";
            jaune="true";
        }else{
            if (element.color==RED){
                rouge="true";
            }
            if (element.color==YELLOW){
                jaune="true";
            }
        }
        if (element.color==URGENCE){
            danger=true;
        }
        var elementList=elements["rectangles"];
        // plus tard : rectangles de type carré
        var min=999999;
        var goodelement = null;
        elementList.forEach(function(elementr) {
            if (elementr.number!=null && elementr.number!=undefined && elementr.number!=""){
                if ((element.center.x<elementr.center.x && element.center.x>elementr.center.x-(elementr.size.w/2)) || (element.center.x>elementr.center.x && element.center.x<elementr.center.x+(elementr.size.w/2))){
                    if ((element.center.y<elementr.center.y && element.center.y>elementr.center.y-(elementr.size.h/2)) || (element.center.y>elementr.center.y && element.center.y<elementr.center.y+(elementr.size.h/2))) {
                        var tmp=(elementr.center.x+(elementr.size.w/2))-element.center.x;
                        if (tmp<min){
                            min=tmp;
                            goodelement=elementr;
                        }
                    }
                }
            }
        });


        var elementList=elements["polygons"];
        elementList.forEach(function(polygon) {
            if (polygon.number!=null && polygon.number!=undefined && polygon.number!=""){
                if (isInside(polygon,polygon.pointList.length,element.center)){
                    goodelement=polygon;
                }
            }
        });


        if (goodelement!=null){
            //alert("Carré trouvé : "+ goodelement.number);
            console.log("CIM---"+goodelement.number+"-"+element.number);
        }


        
/*
        fetch('/getTombe', {method: 'POST',headers: {'Content-Type': 'application/json;charset=utf-8'}, body: 
`{
    "Cimetière": "NR",
    "Carré": "NR",
    "Tombe": "${element.number}",
    "Jaune": ${jaune},
    "Rouge": ${rouge},
    "Danger": ${danger}
}`
    })
        .then(function(response) {
        if(response.ok) {
            console.log('click was recorded');
            return;
        }
        throw new Error('Request failed.');
        })
        .catch(function(error) {
        console.log(error);
        });
*/        
    }

    if (element.category=="rectangles" || element.category=="polygons"){
        if (element.number!=null && element.number!=undefined && element.number!=""){
            //alert("Carré : "+element.number);
            /*
            if (polygon.nature == 2){
                var text = prompt("Numéro du carré : ");
                polygon.number=text;
            }
            */
        }
    }

}

function stopHoverElement()
{
    if (hoveredElement)
    {
        hoveredElement.isHovered = false;
        hoveredElement = null;
    }
}

function hoverElement(element)
{
    stopHoverElement();

    hoveredElement = element;
    element.isHovered = true;
}

function getCursorAfterElementSelection(P, element)
{
    var cursor = "default";

    if (element.category == "graves")
    {
        var grave = element;

        if (testPointOnCorners(P, grave) || testPointOnSides(P, grave))
        {
            cursor = getGraveResizingCursor(P, grave);
        }
        else if (testPointIntoGrave(P, grave))
        {
            cursor = "move";
        }
        else if (testPointOnRotationArrow(P, grave))
        {
            cursor = "grab";
        }
    }
    else if (element.category == "rectangles")
    {
        var rectangle = element;
        if (testPointOnRectangleCorners(P, rectangle) || testPointOnRectangleSides(P, rectangle))
        {
            cursor = getRectangleResizingCursor(P, rectangle);
        }
        else if (testPointOnRectangleCenter(P, rectangle))
        {
            cursor = "move";
        }
        else if (testPointOnRotationArrow(P, rectangle))
        {
            cursor = "grab";
        }
    }
    else if (selectedElement.category == "polygons")
    {
        var polygon = element;
        if (testPointOnPolygonPoints(P, polygon))
        {
            cursor = "grab";
        }
    }
    else if (element.category == "informationElements")
    {
        if (testPointOnResizingPoint(P, element) && element.type != "scale")
        {
            var position = getRotationPosition(element);
            var arrowList = ["ns-resize", "nwse-resize", "ew-resize", "nesw-resize"];
            var i = 1 + position;

            // modulo to make a loop in the array
            i = i % 4;

            cursor = arrowList[i];
        }
        else if (testPointOnInformationElement(M, element))
        {
            cursor = "move";
        }
        else if ((element.type != "scale") && testPointOnRotationArrow(M, element))
        {
            cursor = "grab";
        }
    }

    return cursor;
}

function copyElement(element)
{
    var functionMapping = {
        graves: copyGrave,
        polygons: copyPolygon,
        rectangles: copyRectangleElement,
        informationElements: copyInformationElement
    }
    return functionMapping[element.category](element);
}

function canDeleteElement(element)
{
    return (!(element.category == "informationElements"
                && (element.info == "logo" || element.info == "procedureLegend" || element.info == "tombeLegend" || element.type == "scale"))
            && !(element.category == "rectangles" && element.info == "frame"))
}

function canCopyElement(element)
{
    return (
        !(element.category == "informationElements"
            && (element.info == "logo" || element.info == "procedureLegend"|| element.info == "tombeLegend"  || element.type == "scale"))
        && !(element.category == "rectangles" && element.info == "frame")
        && element.category != "polygons")
}

function areEqualDistancesWithTolerance(dist1, dist2, coeff=1)
{
    //console.log("dist 1:"+dist1);
    //console.log("dist 2:"+dist2);
    //console.log("tolerance distance :"+(selectionDistTolerance*coeff));
    return (dist1 - selectionDistTolerance*coeff <= dist2) && (dist2 <= dist1 + selectionDistTolerance*coeff);
}

function testClosePoints(P1, P2, coeff=1)
{
    var dist = Math.sqrt((P1.x - P2.x)**2 + (P1.y - P2.y)**2);
    return areEqualDistancesWithTolerance(dist, 0, coeff);
}

function getDistance(P1, P2)
{
    return Math.sqrt((P1.x - P2.x)**2 + (P1.y - P2.y)**2);
}

function testPointInCircle(P, C, radius)
{
    var dist = getDistance(P, C);
    return (dist <= radius);
}

// handle camera zoom and movement on a point of the map :
// project a point from the map to the screen
function projectPoint(P)
{
    var P2 = {
        x: (P.x-camera.center.x)*camera.zoom+mapCanvas.width/2,
        y: (P.y-camera.center.y)*camera.zoom+mapCanvas.height/2
    };

    return P2;
}

// project a point from the screen to the map
function projectPointInRealScale(P)
{
    var P2 = {
        x: (P.x/camera.zoom+camera.center.x)-mapCanvas.width/(2*camera.zoom),
        y: (P.y/camera.zoom+camera.center.y)-mapCanvas.height/(2*camera.zoom)
    };

    return P2;
}

function focusOnCenterMap()
{
    camera.center = getMapCenter();
}

function getMapCenter()
{
    var center = {
        "x": map.origin.x + map.w / 2,
        "y": map.origin.y + map.h / 2
    };
    return center;
}

function createMap()
{
    map.init = true;
    addLogo();
    addProcedureLegend();
    addTombeLegend();
    addScale();
    addTitle();
    addFrame();
    console.log("Create a new map");
    deselectElement();
}

function initMap()
{
    refreshSizeCanvas();
    startLoadingAllImages(imagesAreNowLoaded);
}

// refresh all the elements of the map (background and map drawing)
function refresh()
{
    drawMap();
}

function drawMap()
{
    drawAirPhoto();
    drawElements();
}

function refreshSizeCanvas()
{
    var toolbarWidth = 0;
    if (isInModificationMode) {
        toolbarWidth = 200;
    }

    mapCtx.canvas.width  = window.innerWidth - toolbarWidth;
    mapCtx.canvas.height = window.innerHeight;
    
    photoCtx.canvas.width  = window.innerWidth - toolbarWidth;
    photoCtx.canvas.height = window.innerHeight;
}

function copyCamera()
{
    var copiedCamera = {
        "center": {
            "x": camera.center.x,
            "y": camera.center.y
        },
        "zoom": camera.zoom
    };

    return copiedCamera;
}

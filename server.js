const pixel = require("node-pixel");
const firmata = require('firmata');
var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

let stripReady = false;
let mFad = 1;
let staticColor = [0,0,0,255];
let unitMultiplier = 0.1;

let board = new firmata.Board('COM31', function () {

    strip = new pixel.Strip({
        pin: 6, // this is still supported as a shorthand
        length: 30,
        firmata: board,
        color_order: pixel.COLOR_ORDER.RGBW,
        skip_firmware_check: true,
        controller: "FIRMATA",

    });

    strip.on("ready", function () {
        // do stuff with the strip here.
        stripReady = true;
        console.log("Strip ready, let's go");
        strip.color([0, 0, 0, 0]);
        strip.pixel(0).color([100, 0, 0, 0]);
        strip.show();
    });
});

io.on('connection', (socket) => {
    console.log('a user connected: ' + socket.id);
    socket.on('pos_msg', (pos) => {
        console.log('message: ' + pos.posX);
        if (stripReady) {
            let pNum = Math.max(0,Math.min(29,Math.trunc(parseFloat(pos.posX))));
            strip.color([0, 0, 0, 0]);
            if(pNum - mFad > 0) strip.pixel(pNum-mFad).color([0, 0, 0, 10]);
            strip.pixel(pNum).color([0, 0, 0, 255]);
            if(pNum + mFad < 29) strip.pixel(pNum+mFad).color([0, 0, 0, 10]);
            strip.show();
        }
    });
    socket.on('fullframe', (data) => {
        console.log("Full Frame:");
        console.log(data);
    });
    socket.on('frame', (data) => {
        //console.log('message: ' + JSON.stringify(data));
        if (stripReady) {
            switch(data.fixtureID) {
                case "0":
                    if(Object.keys(data).includes("color")) {
                        let pCol = data.color.replace("RGBA(","").replace(")","").split(", ").map((x) => parseFloat(x) * 255);
                        let wColor = rgb2WSimple(pCol[1],pCol[0],pCol[2], data.colorTemp);
                        let fColor = wColor.map((x) => Math.round(x * unitMultiplier * parseFloat(data.intensity.replace(",","."))).clamp(0,255));
                        console.log(fColor);
                        strip.color(fColor);
                        strip.show();
                    } else {
                        let tColor = staticColor.map((x) => Math.round(x * unitMultiplier * parseFloat(data.intensity.replace(",","."))).clamp(0,255));
                        strip.color(tColor);
                        strip.show();
                    }
                    break;
                default:
                    console.log("Unknown fixture id "+data.fixtureID)
                    break;
            }
        }
    });
});

function rgb2WSimple(Ri,Gi,Bi,cT) {
    let wMult = 1.0 - (cT/20000)
    let Wo = Math.max(Ri,Gi,Bi)
    return [Ri,Gi,Bi,Wo*wMult];
}

function rgb2rgbaw(Ri,Gi,Bi,cT) {
    let M = Math.max(Ri,Gi,Bi)
    let m = Math.min(Ri,Gi,Bi)
    
    let Wo = M
    if (m/M < 0.5) Wo = (m*M) / (M-m) 
    let Q = 255
    let K = (Wo + M) / Math.max(m,1)
    let Ro = Math.floor( [ ( K * Ri ) - Wo ] / Q )
    let Go = Math.floor( [ ( K * Gi ) - Wo ] / Q )
    let Bo = Math.floor( [ ( K * Bi ) - Wo ] / Q )

    return [Ro,Go,Bo,Wo];
}

Number.prototype.clamp = function(min, max) {
    return Math.min(Math.max(this, min), max);
  };

http.listen(3000, () => {
    console.log('listening on *:3000');
});
const pixel = require("node-pixel");
const firmata = require('firmata');
var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

let stripReady = false;
let mFad = 1;

const staticColor = [0,0,0,255];
const unitMultiplier = 0.1;
const pixelCount = 82;
const dimming = 0.15;

let vfxActive = false;
let vfxRate = 0;

//Board 
let board = new firmata.Board('COM5', function () {

    strip = new pixel.Strip({
        pin: 6, // this is still supported as a shorthand
        length: pixelCount,
        firmata: board,
        color_order: pixel.COLOR_ORDER.RGBW,
        skip_firmware_check: true,
        controller: "FIRMATA",
        gamma: 1.0,
    });

    strip.on("ready", function () {
        // do stuff with the strip here.
        stripReady = true;
        console.log("Strip ready, let's go");
        strip.color([0, 0, 0, 50]);
        strip.pixel(0).color([200, 0, 0, 0]);
        strip.pixel(pixelCount-1).color([200, 0, 0, 0]);
        strip.show();
    });
});

io.on('connection', (socket) => {
    //User Connection Event
    console.log('a user connected: ' + socket.id);
    
    //Single LED message
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
    
    //Handle VFX event
    socket.on('vfx', (data) => {
        if(data.rate > 0) {
            vfxActive = true;
            vfxRate = data.rate;
        } else if(data.rate <= 0) {
            vfxActive = false;
        }
    });

    //Full single LED frames
    socket.on('fullframe', (data) => {
        if (stripReady) {
            let fixedColorTemp = 20000;
            process.stdout.write('\033c');
            data.forEach(element => {
                let fid = parseInt(element.fixtureID)
                
                //Handle Gap
                if(fid > 40 && fid < 48) return;
                else if(fid >= 48) fid -= 8;

                let pCol = element.color.replace("RGBA(","").replace(")","").split(", ").map((x) => parseInt(x));
                let wColor = rgb2WSimple(pCol[1],pCol[0],pCol[2], fixedColorTemp);
                let fColor = wColor.map((x) => Math.round(x * dimming * parseFloat(element.intensity.replace(",","."))).clamp(0,255));
                if(fid > pixelCount-1) {
                    console.log("Fixture ID too high")
                } else {
                    strip.pixel(fid).color(fColor);
                    //if(fid < 15) console.log(fid+"   "+fColor);
                }
            });
            strip.show();
        }
    });

    //Overall frames (w/ color temp) - handle VFX as well
    socket.on('frame', (data) => {
        //console.log('message: ' + JSON.stringify(data));
        if (stripReady) {
            switch(data.fixtureID) {
                case "0":
                    if(Object.keys(data).includes("color")) {
                        let pCol = data.color.replace("RGBA(","").replace(")","").split(", ").map((x) => parseFloat(x) * 255);
                        let wColor = rgb2WSimple(pCol[1],pCol[0],pCol[2], data.colorTemp);
                        let fColor = wColor.map((x) => Math.round(x * unitMultiplier * dimming * parseFloat(data.intensity.replace(",","."))).clamp(0,255));
                        strip.color(fColor);                       
                    } else {
                        let tColor = staticColor.map((x) => Math.round(x * unitMultiplier * dimming * parseFloat(data.intensity.replace(",","."))).clamp(0,255));
                        strip.color(tColor);
                    }
                    break;
                default:
                    console.log("Unknown fixture id "+data.fixtureID)
                    break;
            }
            if(vfxActive) {
                let vfxcol = [100,10,250,10]; //BRGW
                let vfxProb = (vfxRate/1400) * 0.3; // 0 = no particles, 1 = max particles 
                for (let i = 0; i < pixelCount; i++) {
                    if(Math.random() < vfxProb) {
                        strip.pixel(i).color(vfxcol);
                    }                    
                }
            }
            strip.show();
        }
    });
});

function rgb2WSimple(Ri,Gi,Bi,cT) {
    let wMult = 1.0 - (cT/20000)
    let Wo = Math.max(Ri,Gi,Bi)
    return [Ri,Gi,Bi,Wo*wMult];
}

Number.prototype.clamp = function(min, max) {
    return Math.min(Math.max(this, min), max);
  };

http.listen(3000, () => {
    console.log('listening on *:3000');
});
var SerialPort = require("serialport");
var xbee_api = require("xbee-api");
var C = xbee_api.constants;
//var storage = require("./storage");
const mqtt = require("mqtt");

require("dotenv").config();

const SERIAL_PORT = process.env.SERIAL_PORT;

let isActivated = false;

var xbeeAPI = new xbee_api.XBeeAPI({
  api_mode: 2,
});

const mainTopic = "/alarm-iot/activate";

const mqttClient = mqtt.connect("wss://test.mosquitto.org:8081");

mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");
  mqttClient.subscribe(mainTopic);
});
mqttClient.on("message", (topic, message) => {
  const payload = JSON.parse(message.toString());
  console.log(`Received message on ${topic}:`, payload);
  // Process the received message and update your state here
});

mqttClient.on("error", (error) => {
  console.error("MQTT error:", error);
});

let serialport = new SerialPort(
  SERIAL_PORT,
  {
    baudRate: parseInt(process.env.SERIAL_BAUDRATE) || 9600,
  },
  function (err) {
    if (err) {
      return console.error("Error: ", err.message);
    }
  }
);

serialport.pipe(xbeeAPI.parser);
xbeeAPI.builder.pipe(serialport);

var frame_obj;

serialport.on("open", function () {
  // const PAN_ID = 5544;
  //ID -> PAN_ID
  // frame_obj = {
  //   // AT Request to be sent
  //   type: C.FRAME_TYPE.AT_COMMAND,
  //   command: "ID",
  //   commandParameter: [PAN_ID],
  // };
  //xbeeAPI.builder.write(frame_obj);

  //013A20041FB76B1 -> Arduino
  frame_obj = {
    // AT Request to be sent
    type: C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
    destination64: "0013A20041FB76B1",
    command: "AP",
    commandParameter: ["0"],
  };
  xbeeAPI.builder.write(frame_obj);

  // frame_obj = {
  //   // AT Request to be sent
  //   type: C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
  //   destination64: "0013A20041FB76B1",
  //   command: "ID",
  //   commandParameter: [PAN_ID],
  // };
  // xbeeAPI.builder.write(frame_obj);

  //0013A20041FB5A5C -> Laser
  // frame_obj = {
  //   type: C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
  //   destination64: "0013A20041FB5A5C",
  //   command: "ID",
  //   commandParameter: [PAN_ID],
  // };
  // xbeeAPI.builder.write(frame_obj);

  frame_obj = {
    type: C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
    destination64: "0013A20041FB5A5C",
    command: "D0",
    commandParameter: ["2"],
  };
  xbeeAPI.builder.write(frame_obj);

  frame_obj = {
    type: C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
    destination64: "0013A20041FB5A5C",
    command: "IC",
    commandParameter: ["1"],
  };
  xbeeAPI.builder.write(frame_obj);

  frame_obj = {
    type: C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
    destination64: "0013A20041FB5A5C",
    command: "IR",
    commandParameter: ["1000"],
  };
  xbeeAPI.builder.write(frame_obj);

  frame_obj = {
    type: C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
    destination64: "0013A20041FB5A5C",
    command: "AP",
    commandParameter: ["2"],
  };
  xbeeAPI.builder.write(frame_obj);

  frame_obj = {
    type: C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
    destination64: "0013A20041FB5A5C",
    command: "KY",
    commandParameter: ["00"],
  };
  xbeeAPI.builder.write(frame_obj);

  frame_obj = {
    type: C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
    destination64: "0013A20041FB5A5C",
    command: "NK",
    commandParameter: ["00"],
  };
  xbeeAPI.builder.write(frame_obj);
});

// All frames parsed by the XBee will be emitted here

// storage.listSensors().then((sensors) => sensors.forEach((sensor) => console.log(sensor.data())))

function checkLaserEntry(value) {
  if (value > 200) {
    console.log("Obstacle in the way !");
  } else {
    //console.log("...");
  }
}

xbeeAPI.parser.on("data", function (frame) {
  //on new device is joined, register it

  //on packet received, dispatch event
  //let dataReceived = String.fromCharCode.apply(null, frame.data);
  if (C.FRAME_TYPE.ZIGBEE_RECEIVE_PACKET === frame.type) {
    //Digicode
    console.log("C.FRAME_TYPE.ZIGBEE_RECEIVE_PACKET");
    let dataReceived = String.fromCharCode.apply(null, frame.data);
    console.log(">> ZIGBEE_RECEIVE_PACKET >", dataReceived);
  } else if (C.FRAME_TYPE.NODE_IDENTIFICATION === frame.type) {
    // let dataReceived = String.fromCharCode.apply(null, frame.nodeIdentifier);
    console.log("NODE_IDENTIFICATION");
    //storage.registerSensor(frame.remote64)
  } else if (C.FRAME_TYPE.ZIGBEE_IO_DATA_SAMPLE_RX === frame.type) {
    //console.log("ZIGBEE_IO_DATA_SAMPLE_RX");
    //console.log("laser isLighted:", frame.analogSamples);
    checkLaserEntry(frame.analogSamples.AD0);
    //storage.registerSample(frame.remote64,frame.analogSamples.AD0 )
  } else if (C.FRAME_TYPE.REMOTE_COMMAND_RESPONSE === frame.type) {
    console.log("REMOTE_COMMAND_RESPONSE", frame);
  } else {
    console.debug(frame, "test");
    let dataReceived = String.fromCharCode.apply(null, frame.commandData);
    console.log(dataReceived);
  }
});

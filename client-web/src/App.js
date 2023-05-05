import React, { useState } from "react";
import mqtt from 'mqtt';
import './App.css';

function App() {

  const [dataList, setDataList] = useState([]);
  const [isActive, setIsActive] = useState(true);
  const baseTopic = "/alarm-iot";
  const activateTopic = baseTopic + "/activate";
  const alertTopic = baseTopic + "/alert";
  const authTopic = baseTopic + "/authDigi";
  const [switchLabel, setSwitchLabel] = useState("OFF");
  function updateDataList (newData) {
    setDataList((prevDataList) => [...prevDataList, newData]);
  }
  const toggleChange = () => {
    setIsActive(!isActive);
    console.log(isActive);
    if(isActive === false) {
      setTimeout(() => {
        setDataList([]);
      }, 1000);
    }
    setSwitchLabel(isActive ===true ? "ON" : "OFF");
    sendMessage(activateTopic , { activate: isActive });
  };

  function setupMqttClient () {
    const mqttClient = mqtt.connect('wss://test.mosquitto.org:8081');

    mqttClient.on('connect', () => {
      console.log('Connected to MQTT broker');
      mqttClient.subscribe(activateTopic + '/on' );
      mqttClient.subscribe(activateTopic + '/off' );
      mqttClient.subscribe(authTopic + '/incorrect' );
      mqttClient.subscribe(authTopic + '/correct' );
      mqttClient.subscribe(alertTopic );
    });
    mqttClient.on('message', (topic, message) => {
      const payload = JSON.parse(message.toString());
      console.log(`Received message on ${topic}:`, payload.toString());
      switch (topic){
        case (activateTopic+'/on' ):
          updateDataList(payload.toString());
          break;
        case (activateTopic+'/off'):
          updateDataList(payload.toString());
          break;
        case(alertTopic):
          updateDataList(<span className="alert">{payload.toString()}</span>);
          break;
        case(authTopic + '/incorrect'):
          updateDataList(<span className="incorrect">{payload.toString()}</span>);
          break;
        case(authTopic + '/correct'):
          updateDataList(<span className="correct">{payload.toString()}</span>);
          break;
        default: break;
      }
    });

    mqttClient.on('error', (error) => {
      console.error('MQTT error:', error);
    });

    const sendMessage = (topic, message) => {
      const payload = JSON.stringify(message);
      console.log(`--> Send message on ${topic}:`, message);
      mqttClient.publish(topic, payload);
    };
    return { mqttClient, sendMessage };
  };

  const { mqttClient, sendMessage } = setupMqttClient();


  return (
    <div className="App">
     <h1>
       {
         switchLabel
       }
     </h1>

      <label className="switch" >
        <input type="checkbox" value={isActive} onChange={toggleChange}></input>
        <span className="slider round"></span>
      </label>
      <div className="container">
        <ul>
          {dataList.map((data, index) => (
            <li key={index}>{data}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;

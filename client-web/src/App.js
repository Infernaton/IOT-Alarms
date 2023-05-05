import React, { useEffect, useMemo, useState } from "react";
import mqtt from 'mqtt';
import './App.css';

function App() {

  const [dataList, setDataList] = useState([]);
  const [isActive, setIsActive] = useState(false);
  let newValue = false;
  const baseTopic = "/alarm-iot";
  const activateTopic = baseTopic + "/activate";
  const alertTopic = baseTopic + "/alert";

  const toggleChange = () => {
      setIsActive(!isActive);
      newValue = isActive;
      sendMessage(activateTopic , { activate: newValue });
  };


  const updateDataList = (newData) => {
    setDataList((prevDataList) => [...prevDataList, newData]);
  };

  function setupMqttClient () {
    const mqttClient = mqtt.connect('wss://test.mosquitto.org:8081');

    mqttClient.on('connect', () => {
      console.log('Connected to MQTT broker');
      mqttClient.subscribe(activateTopic + '/on' );
      mqttClient.subscribe(activateTopic + '/off' );
      mqttClient.subscribe(alertTopic );
    });
    mqttClient.on('message', (topic, message) => {
      const payload = JSON.parse(message.toString());
      switch (topic){
        case (activateTopic+'/on' ):
          console.log(`Received message on ${topic}:`, payload.toString());
          updateDataList(payload.toString());
          break;
          case (activateTopic+'/off'):
          console.log(`Received message on ${topic}:`, payload.toString());
            updateDataList(payload.toString());
            break;
        case(alertTopic):
          console.log(`Received message on ${topic}:`, payload.toString());
          updateDataList(<span className="alert">{payload.toString()}</span>);

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


      <label className="switch" >
        <input type="checkbox" value={isActive} onChange={toggleChange}></input>
        <span className="slider round"></span>
      </label>
      {
        isActive === true ?
          <div className="container">
            <ul>
              {dataList.map((data, index) => (
                <li key={index}>{data}</li>
              ))}
            </ul>
          </div>
          :
        <p> Y'a rien</p>
      }
    </div>
  );
}

export default App;

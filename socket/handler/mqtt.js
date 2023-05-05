function sendMessage(topic, message) {
  const payload = JSON.stringify(message);
  console.log(`--> Send message on ${topic}:`, message);
  mqttClient.publish(topic, payload);
}

module.exports = {
  sendMessage,
};

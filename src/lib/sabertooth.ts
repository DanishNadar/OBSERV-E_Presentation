// car_firmware: Sabertooth 2x12 packetized serial (address, command, data, checksum)
export const sabertoothPacket = (motorIndex: number, speed: number, address = 128) => {
  const motorSelect = (motorIndex % 2) * 4;
  const reverse = speed < 0;
  const command = motorSelect + (reverse ? 1 : 0);
  const data = Math.min(127, Math.abs(Math.round(speed)));
  const checksum = (address + command + data) & 127;
  return { address, command, data, checksum };
};

export const hex = (v: number) => `0x${v.toString(16).toUpperCase().padStart(2, "0")}`;

import { networkInterfaces } from "systeminformation";

networkInterfaces().then(resp => console.log(resp));

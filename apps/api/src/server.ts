import { app } from "./app.js";
import { env } from "./config/env.js";
app.listen(env.API_PORT,()=>console.log(`RentPilot API listening on ${env.API_PORT}`));

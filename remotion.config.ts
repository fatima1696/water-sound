import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(18);
// Software WebGL on a CI machine can be slow on the first frame of a heavy scene.
Config.setDelayRenderTimeoutInMilliseconds(180000);

import * as Comlink from "comlink";
import { ExplorerService } from "../lib/explorer-service";

Comlink.expose(new ExplorerService());

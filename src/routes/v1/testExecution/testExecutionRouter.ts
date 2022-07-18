import * as fastify from "fastify"
import { executions } from "./executions"


export const testExecutionRouter = async (app: fastify.FastifyInstance) => {
    app.register(await executions, {prefix: "/api/v1/execution"})
}

import * as fastify from "fastify"
import { testExecutionRouter } from "./v1/testExecution/testExecutionRouter"

export default async (app: fastify.FastifyInstance) => {
    await testExecutionRouter(app)
}

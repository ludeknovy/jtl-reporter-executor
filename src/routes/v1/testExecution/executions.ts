import * as fastify from "fastify"
import {HttpStatusCode} from "../../../model/httpStatusCode";
import {spawn, exec, execSync} from "child_process"
import {db} from "../../../db/db"
import {v4 as uuidv4} from 'uuid'
import {
    createExecution,
    createExecutionLog, getExecutionFiles,
    getExecutionInfo,
    setExecutionPid,
    terminateExecution
} from "../../../queries/executions";
import {ExecutionStatus} from "../../../model/executionStatus";
import * as fs from "fs";


// eslint-disable-next-line require-await
export const executions = async (app: fastify.FastifyInstance) => {
    app.post<{ Body: { scenarioId: string; executionOptions: ExecutionOptions } }>("/start", async (request, response) => {
        try {
            const EXECUTION_ARGS = ["./bzt/template.yml"]
            const {scenarioId, executionOptions} = request.body
            const executionId = uuidv4()
            request.log.info(`starting execution with id: ${executionId}`)
            await db.query(createExecution(executionId))

            const files = await db.manyOrNone(getExecutionFiles(scenarioId))
            console.log(files)

            if (!files) {
                return response.code(HttpStatusCode.BadRequest).send()
            }

            fs.mkdirSync(`./executions/${executionId}`, {recursive: true})

            files.forEach(file => {
                fs.writeFileSync(`executions/${executionId}/${file.filename}`, file.content)
            })

            const jmxFile = files.find(file => file.filename.endsWith(".jmx"))

            if (jmxFile) {
                EXECUTION_ARGS.push(`-o`, `scenarios.test.script=./executions/${executionId}/${jmxFile.filename}`)
            }

            if (executionOptions) {
                for (const [key, value] of Object.entries(executionOptions)) {
                    EXECUTION_ARGS.push("-o", `execution.0.${key}=${value}`)
                }
            }

            const executionCommand = spawn("bzt", EXECUTION_ARGS)
            await db.query(setExecutionPid(executionId, executionCommand.pid))

            executionCommand.stdout.on('data', async function (data) {
                console.log(data.toString())
                await db.query(createExecutionLog(executionId, data.toString(), "INFO"))
            });

            executionCommand.stderr.on('data', async function (data) {
                await db.query(createExecutionLog(executionId, data.toString(), "ERROR")
                )
            });

            executionCommand.on('exit', async function (code) {
                await db.query(terminateExecution(executionId))
            });

        } catch (e) {
            request.log.error("Execution failed: " + e)
            return response.code(HttpStatusCode.ServerError).send()

        }
        response.code(HttpStatusCode.Created).send()
    })

    app.post<{ Body: TerminateExecutionBody }>("/terminate", async (request, response) => {
        const {executionId} = request.body
        console.log(executionId)
        const queryResult = await db.oneOrNone(getExecutionInfo(executionId))
        if (queryResult.status === ExecutionStatus.Running) {
            const PID = queryResult.pid

            try {
                const stdout = execSync(`ps -a ${PID}`)

                console.log(`stdout: ${stdout}`);
                if (stdout.includes(`./executions/${executionId}`)) {
                    process.kill(PID)
                    response.code(HttpStatusCode.OK).send("Execution PID has been terminated")

                } else {
                    request.log.info("PID is already taken by another process, terminating execution")
                    await db.query(terminateExecution(executionId))
                    response.code(HttpStatusCode.BadRequest).send("Execution PID has been already assigned to another process")
                }

            } catch (error) {
                request.log.error(`error: ${error.message}`);
                request.log.info("PID related to execution is not running anymore, changing the state of execution to `terminated`")
                await db.query(terminateExecution(executionId))
                response.code(HttpStatusCode.BadRequest).send("Execution has been already terminated")
                return

            }


        } else {
            response.code(HttpStatusCode.BadRequest).send("Execution has been already terminated")
        }

    })
}


interface TerminateExecutionBody {
    executionId: string
}

interface ExecutionOptions {
    "ramp-up": number
    concurrency: number
    "hold-for": number
    steps: number
    iterations: number
    throughput: number
}

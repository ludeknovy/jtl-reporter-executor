import {ExecutionStatus} from "../model/executionStatus";

export const createExecution = (executionId) => {
    return {
        text: `INSERT INTO jtl.execution(id, status) VALUES ($1, $2)`,
        values: [executionId, ExecutionStatus.Running]}
}

export const setExecutionPid = (executionId, pid) => {
    return {
        text: `UPDATE jtl.execution SET pid = $1 WHERE id = $2`,
            values: [pid, executionId]
    }
}

export const createExecutionLog = (executionId, log, level) => {
    return {
        text: `INSERT INTO jtl.execution_logs(execution_id, log, level)
                               VALUES ($1, $2, $3)`,
        values: [executionId, log, level]
    }
}

export const terminateExecution = (executionId) => {
    return {
        text: `UPDATE jtl.execution SET status = $1, end_date = $2 WHERE id = $3`,
        values: [ExecutionStatus.Terminated, new Date(), executionId]
    }
}

export const getExecutionInfo = (executionId) => {
    return {
        text: `SELECT status, pid from jtl.execution WHERE id = $1`,
        values: [executionId]
    }
}

export const getExecutionFiles = (scenarioId) => {
    return {
        text: `SELECT content, filename FROM jtl.execution_files WHERE scenario_id = $1`,
        values: [scenarioId]
    }
}

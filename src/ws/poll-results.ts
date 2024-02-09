import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { voting } from "../utils/voting-pub-sub";
export async function resultsPoll(app: FastifyInstance) {
    app.get('/polls/:pollId/results', { websocket: true }, (connection, request) => {
        const getPollParams = z.object({
            pollId: z.string().uuid()
        })
        const { pollId } = getPollParams.parse(request.params);
        voting.subscribe(pollId, (message) => {
            connection.socket.send(JSON.stringify(message));
        })
    })

}

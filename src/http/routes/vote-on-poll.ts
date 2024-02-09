import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma";
import { z } from "zod";
import { randomUUID } from "crypto";
import { redis } from "../../lib/redis";
import { voting } from "../../utils/voting-pub-sub";
export async function voteOnPoll(app: FastifyInstance) {
    app.post('/polls/:pollId/vote', async (request, reply) => {
        const voteOnPollBody = z.object({
            pollOptionId: z.string().uuid()
        })
        const voteOnPollParams = z.object({
            pollId: z.string().uuid()
        })
        const { pollOptionId } = voteOnPollBody.parse(request.body);
        const { pollId } = voteOnPollParams.parse(request.params);
        let sessionId = request.cookies.sessionId;
        if (!sessionId) {
            sessionId = randomUUID();
            reply.setCookie('sessionId', sessionId, {
                path: '/',
                maxAge: 60 * 60 * 24 * 30,
                signed: true,
                httpOnly: true
            })
        } else {
            const userPreviousVoteOnPoll = await prisma.vote.findUnique({
                where: {
                    sessionId_pollId: {
                        sessionId,
                        pollId
                    }
                }
            })
            if (userPreviousVoteOnPoll && userPreviousVoteOnPoll.pollOptionId != pollOptionId) {
                await prisma.vote.delete({
                    where: {
                        id: userPreviousVoteOnPoll.id
                    }
                })
               const votes = await redis.zincrby(pollId, -1, userPreviousVoteOnPoll.pollOptionId);
                voting.publish(pollId, { pollOptionId:userPreviousVoteOnPoll.pollOptionId, votes: Number(votes) })

            } else if (userPreviousVoteOnPoll) {
                return reply.status(400).send({ message: 'You already voted on this poll!' })
            }
        }
        prisma.vote.create({
            data: {
                sessionId,
                pollId,
                pollOptionId
            }
        })

        const votes = await redis.zincrby(pollId, 1, pollOptionId);
        voting.publish(pollId, { pollOptionId, votes: Number(votes) })
        return reply.send()
    })

}

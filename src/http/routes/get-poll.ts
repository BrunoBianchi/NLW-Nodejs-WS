import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma";
import { z } from "zod";
import { redis } from "../../lib/redis";
export async function getPoll(app: FastifyInstance) {
    app.get('/polls/:id', async (request, reply) => {
        const getPollParams = z.object({
            id: z.string().uuid()
        })
        const { id } = getPollParams.parse(request.params);
        const poll = await prisma.poll.findUnique({
            where: {
                id: id,
            },
            include: {
                options: {
                    select: {
                        id: true,
                        title: true
                    }
                }
            }
        })
        const results = await redis.zrange(id, 0, -1, 'WITHSCORES');
        const votes = results.reduce((obj, line, index) => {
            if (index % 2 == 0) {
                const score = results[index + 1];
                Object.assign(obj, { [line]: Number(score) })
                
            }
            return obj;
        }, {} as Record<string, number>)
        return reply.send({ poll: {
            id:poll?.id,
            title:poll?.title,
            options:poll?.options.map(option=>{
                return {
                    id:option.id,
                    title:option.title,
                    votes:(option.id in votes)?votes[option.id]:0,
                }
            })
        } })
    })

}

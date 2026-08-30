import { FastifyPluginAsync } from 'fastify';
import { User, UserRole } from '../types/index.js';
import { ApiResponse } from '../types/index.js';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { phone: string }; Reply: ApiResponse<{ message: string; requestId: string }> }>(
    '/api/auth/login',
    async (request, reply) => {
      const { phone } = request.body;

      if (!phone) {
        return reply.status(400).send({
          success: false,
          error: 'Phone number is required',
        });
      }

      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      return {
        success: true,
        message: 'OTP sent',
        data: {
          message: 'OTP sent',
          requestId,
        },
      };
    }
  );

  fastify.post<{
    Body: { phone: string; otp: string };
    Reply: ApiResponse<{ token: string; user: Omit<User, 'createdAt'> }>;
  }>('/api/auth/verify-otp', async (request, reply) => {
    const { phone, otp } = request.body;

    if (!phone || !otp) {
      return reply.status(400).send({
        success: false,
        error: 'Phone and OTP are required',
      });
    }

    const mockUser: Omit<User, 'createdAt'> = {
      id: 'user-1',
      phone,
      name: 'अशा कार्यकर्ता',
      role: UserRole.ASHA,
      facilityId: 'facility-1',
    };

    return {
      success: true,
      data: {
        token: 'mock-jwt-token',
        user: mockUser,
      },
    };
  });
};

export default authRoutes;

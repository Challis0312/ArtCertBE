// Mock the entire database module to return a mock pool immediately
jest.mock('../../src/database/getDBPool', () => ({
  getDBPool: jest.fn(() => Promise.resolve({
    query: jest.fn(),
    end: jest.fn()
  })),
  getDBConnection: jest.fn(() => Promise.resolve({
    query: jest.fn(),
    release: jest.fn(),
    end: jest.fn()
  }))
}));

// Mock utility modules
jest.mock('../../src/utils/limitOffsetGuardCheck');
jest.mock('../../src/utils/variableGuardCheck');

// Now we can safely import without any database connection attempts
const OfferService = require('../../src/services/OfferService');
const db = require('../../src/database/getDBPool');
const utils = require('../../src/utils/limitOffsetGuardCheck');
const variableGuards = require('../../src/utils/variableGuardCheck');

describe('OfferService', () => {
    let mockQuery;
    let mockClient;

    beforeEach(() => {
        // Get reference to the mocked query function
        mockQuery = jest.fn();
        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };
        
        db.getDBPool.mockResolvedValue({
            query: mockQuery,
            end: jest.fn()
        });
        
        db.getDBConnection.mockResolvedValue(mockClient);
        
        jest.clearAllMocks();
    });

    describe('postOffer', () => {
        it('resolves with message and status on success', async () => {
            // PostgreSQL format: return rows with the inserted record
            mockQuery.mockResolvedValueOnce({
                rowCount: 1,
                rows: [{ offer_id: 1 }]
            });
            
            const body = { amount: 100, userID: 2 };
            const sub = 'user-sub-123';
            const result = await OfferService.postOffer(1, body, sub);
            
            expect(result).toHaveProperty('status', 200);
            expect(result).toHaveProperty('message');
            expect(mockQuery).toHaveBeenCalledTimes(1);
        });

        it('rejects with message and status on failure', async () => {
            mockQuery.mockRejectedValueOnce(new Error('Database error'));
            
            const body = { amount: 100, userID: 2 };
            const sub = 'user-sub-123';
            
            await expect(OfferService.postOffer(1, body, sub)).rejects.toHaveProperty('status', 406);
        });
    });

    describe('listOffers', () => {
        it('rejects if limitOffsetGuardCheck fails', async () => {
            utils.limitOffsetGuardCheck.mockReturnValue({ 
                status: 406, 
                message: 'Invalid parameters' 
            });
            
            await expect(OfferService.listOffers(1, 0, 10)).rejects.toHaveProperty('status', 406);
            expect(mockQuery).not.toHaveBeenCalled();
        });

        it('resolves with offers on success', async () => {
            utils.limitOffsetGuardCheck.mockReturnValue({ 
                status: 200, 
                message: { limit: 10, offset: 0 } 
            });
            
            const mockOffers = [{ offer_id: 1, amount: 100, status: 'pending' }];
            // PostgreSQL format: data is in rows property
            mockQuery.mockResolvedValueOnce({
                rowCount: 1,
                rows: mockOffers
            });
            
            const result = await OfferService.listOffers(1, 0, 10);
            
            expect(result).toHaveProperty('status', 200);
            expect(result.message).toBeInstanceOf(Array);
            expect(result.message).toEqual(mockOffers);
        });

        it('returns 404 when no offers found', async () => {
            utils.limitOffsetGuardCheck.mockReturnValue({ 
                status: 200, 
                message: { limit: 10, offset: 0 } 
            });
            
            // PostgreSQL format: empty rows array
            mockQuery.mockResolvedValueOnce({
                rowCount: 0,
                rows: []
            });
            
            await expect(OfferService.listOffers(1, 0, 10)).rejects.toHaveProperty('status', 404);
        });

        it('rejects on database failure', async () => {
            utils.limitOffsetGuardCheck.mockReturnValue({ 
                status: 200, 
                message: { limit: 10, offset: 0 } 
            });
            
            mockQuery.mockRejectedValueOnce(new Error('Query failed'));
            
            await expect(OfferService.listOffers(1, 0, 10)).rejects.toHaveProperty('status', 406);
        });
    });

    describe('listSentOffers', () => {
        it('rejects if limitOffsetGuardCheck fails', async () => {
            utils.limitOffsetGuardCheck.mockReturnValue({ 
                status: 406, 
                message: 'Invalid parameters' 
            });
            
            await expect(OfferService.listSentOffers(1, 0, 10)).rejects.toHaveProperty('status', 406);
            expect(mockQuery).not.toHaveBeenCalled();
        });

        it('resolves with sent offers on success', async () => {
            utils.limitOffsetGuardCheck.mockReturnValue({ 
                status: 200, 
                message: { limit: 10, offset: 0 } 
            });
            
            const mockOffers = [{ offer_id: 1, user_id: 1, amount: 100, status: 'pending' }];
            mockQuery.mockResolvedValueOnce({
                rowCount: 1,
                rows: mockOffers
            });
            
            const result = await OfferService.listSentOffers(1, 0, 10);
            
            expect(result).toHaveProperty('status', 200);
            expect(result.message).toEqual(mockOffers);
        });

        it('returns 404 when no sent offers found', async () => {
            utils.limitOffsetGuardCheck.mockReturnValue({ 
                status: 200, 
                message: { limit: 10, offset: 0 } 
            });
            
            mockQuery.mockResolvedValueOnce({
                rowCount: 0,
                rows: []
            });
            
            await expect(OfferService.listSentOffers(1, 0, 10)).rejects.toHaveProperty('status', 404);
        });
    });

    describe('listReceivedOffers', () => {
        it('rejects if limitOffsetGuardCheck fails', async () => {
            utils.limitOffsetGuardCheck.mockReturnValue({ 
                status: 406, 
                message: 'Invalid parameters' 
            });
            
            await expect(OfferService.listReceivedOffers(1, 0, 10)).rejects.toHaveProperty('status', 406);
            expect(mockQuery).not.toHaveBeenCalled();
        });

        it('resolves with received offers on success', async () => {
            utils.limitOffsetGuardCheck.mockReturnValue({ 
                status: 200, 
                message: { limit: 10, offset: 0 } 
            });
            
            const mockOffers = [
                { 
                    offer_id: 1, 
                    offer_amount: 100, 
                    sender_id: 2,
                    artwork_id: 1,
                    status: 'pending',
                    created_at: '2024-01-01T10:00:00Z',
                    artwork_name: 'Test Artwork',
                    author_first_name: 'John',
                    author_last_name: 'Doe'
                }
            ];
            mockQuery.mockResolvedValueOnce({
                rowCount: 1,
                rows: mockOffers
            });
            
            const result = await OfferService.listReceivedOffers(1, 0, 10);
            
            expect(result).toHaveProperty('status', 200);
            expect(result.message).toEqual(mockOffers);
        });

        it('returns 404 when no received offers found', async () => {
            utils.limitOffsetGuardCheck.mockReturnValue({ 
                status: 200, 
                message: { limit: 10, offset: 0 } 
            });
            
            mockQuery.mockResolvedValueOnce({
                rowCount: 0,
                rows: []
            });
            
            await expect(OfferService.listReceivedOffers(1, 0, 10)).rejects.toHaveProperty('status', 404);
        });
    });

    describe('putOffer', () => {
        it('resolves when offer updated with non-accepted status', async () => {
            // PostgreSQL format: use rowCount instead of affectedRows
            mockQuery.mockResolvedValueOnce({
                rowCount: 1,
                rows: []
            });
            
            const result = await OfferService.putOffer(1, 'rejected');
            
            expect(result).toHaveProperty('status', 202);
            expect(result).toHaveProperty('message', 'Offer updated successfully');
        });

        it('resolves when offer accepted and transaction processed successfully', async () => {
            // First call: putOfferDB - PostgreSQL format
            mockQuery.mockResolvedValueOnce({ 
                rowCount: 1, 
                rows: [] 
            });
            
            // Mock client queries for processTransaction
            mockClient.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ 
                    rowCount: 1, 
                    rows: [{ 
                        transaction_id: 'test-transaction-123', 
                        processed_at: '2024-01-01T10:00:00Z' 
                    }] 
                }) // INSERT transaction with RETURNING
                .mockResolvedValueOnce({ 
                    rowCount: 1, 
                    rows: [] 
                }) // UPDATE artwork ownership
                .mockResolvedValueOnce({ 
                    rowCount: 2, 
                    rows: [] 
                }) // UPDATE offers (reject others)
                .mockResolvedValueOnce({ 
                    rowCount: 1, 
                    rows: [] 
                }) // UPDATE artwork (mark sold)
                .mockResolvedValueOnce({}); // COMMIT

            const result = await OfferService.putOffer(1, 'accepted');
            
            expect(result).toHaveProperty('status', 202);
            expect(result).toHaveProperty('message', 'Offer updated successfully');
            expect(mockQuery).toHaveBeenCalledTimes(1); // putOfferDB
            expect(mockClient.query).toHaveBeenCalledTimes(6); // processTransaction
            expect(mockClient.release).toHaveBeenCalledTimes(1);
        });

        it('rejects when transaction fails on accepted offer', async () => {
            // First call succeeds (putOfferDB)
            mockQuery.mockResolvedValueOnce({
                rowCount: 1,
                rows: []
            });
            
            // Transaction BEGIN succeeds, but INSERT fails
            mockClient.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockRejectedValueOnce(new Error('Transaction insert failed'));
            
            await expect(OfferService.putOffer(1, 'accepted')).rejects.toHaveProperty('status', 406);
            expect(mockClient.release).toHaveBeenCalledTimes(1);
        });

        it('rejects when no rows affected in putOfferDB', async () => {
            // PostgreSQL format: use rowCount instead of affectedRows
            mockQuery.mockResolvedValueOnce({
                rowCount: 0,
                rows: []
            });
            
            await expect(OfferService.putOffer(1, 'pending')).rejects.toHaveProperty('status', 404);
        });

        it('rejects when transaction creation fails (no rows returned)', async () => {
            // First call succeeds (putOfferDB)
            mockQuery.mockResolvedValueOnce({
                rowCount: 1,
                rows: []
            });
            
            // Mock transaction queries - BEGIN succeeds, INSERT returns no rows
            mockClient.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ 
                    rowCount: 0, 
                    rows: [] 
                }); // INSERT transaction fails (no rows returned)
            
            await expect(OfferService.putOffer(1, 'accepted')).rejects.toHaveProperty('status', 406);
            expect(mockClient.release).toHaveBeenCalledTimes(1);
        });

        it('rejects when artwork ownership update fails', async () => {
            // First call succeeds (putOfferDB)
            mockQuery.mockResolvedValueOnce({
                rowCount: 1,
                rows: []
            });
            
            // Mock transaction queries
            mockClient.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ 
                    rowCount: 1, 
                    rows: [{ transaction_id: 'test-123', processed_at: new Date() }] 
                }) // INSERT transaction succeeds
                .mockResolvedValueOnce({ 
                    rowCount: 0, 
                    rows: [] 
                }); // UPDATE artwork fails (no rows affected)
            
            await expect(OfferService.putOffer(1, 'accepted')).rejects.toHaveProperty('status', 406);
            expect(mockClient.release).toHaveBeenCalledTimes(1);
        });

        it('handles database error in putOfferDB', async () => {
            mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));
            
            await expect(OfferService.putOffer(1, 'pending')).rejects.toHaveProperty('status', 406);
        });

        it('rolls back transaction on any failure during processing', async () => {
            // First call succeeds (putOfferDB)
            mockQuery.mockResolvedValueOnce({
                rowCount: 1,
                rows: []
            });
            
            // Mock transaction - fail during COMMIT
            mockClient.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ 
                    rowCount: 1, 
                    rows: [{ transaction_id: 'test-123', processed_at: new Date() }] 
                }) // INSERT transaction
                .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // UPDATE artwork
                .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // UPDATE offers
                .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // UPDATE artwork sold
                .mockRejectedValueOnce(new Error('COMMIT failed')); // COMMIT fails
            
            await expect(OfferService.putOffer(1, 'accepted')).rejects.toHaveProperty('status', 406);
            expect(mockClient.release).toHaveBeenCalledTimes(1);
        });
    });
});
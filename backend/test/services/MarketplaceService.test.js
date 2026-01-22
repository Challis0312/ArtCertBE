// Mock the entire database module to return a mock pool immediately
jest.mock('../../src/database/getDBPool', () => ({
  getDBPool: jest.fn(() => Promise.resolve({
    query: jest.fn(),
    end: jest.fn()
  }))
}));

// Mock utility modules
jest.mock('../../src/utils/limitOffsetGuardCheck');
jest.mock('../../src/utils/variableGuardCheck');

// Now we can safely import without any database connection attempts
const MarketplaceService = require('../../src/services/MarketplaceService');
const db = require('../../src/database/getDBPool');
const utils = require('../../src/utils/limitOffsetGuardCheck');

describe('MarketplaceService', () => {
  let mockQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery = jest.fn();
    db.getDBPool.mockResolvedValue({
      query: mockQuery,
      end: jest.fn(),
    });

  });

  /* getArtistProfileInMarket */
  describe('getArtistProfileInMarket', () => {
    const artistID = 42;
    const limit = 10;
    const offset = 0;

    it('resolves with rows on success', async () => {
      // limitOffsetGuardCheck is called inside the DB helper via try/catch, so return normally
      utils.limitOffsetGuardCheck.mockReturnValue({ status: 200, message: { limit, offset } });

      const rows = [{ artwork_id: 1 }, { artwork_id: 2 }];
      mockQuery.mockResolvedValueOnce({ rows, rowCount: rows.length });

      const result = await MarketplaceService.getArtistProfileInMarket(artistID, limit, offset, {});
      expect(result).toHaveProperty('status', 200);
      expect(result).toHaveProperty('message', rows);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT *'),
        [artistID, limit, offset]
      );
    });

    it('rejects with 404 when no data found', async () => {
      utils.limitOffsetGuardCheck.mockReturnValue({ status: 200, message: { limit, offset } });
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(
        MarketplaceService.getArtistProfileInMarket(artistID, limit, offset, {})
      ).rejects.toHaveProperty('status', 404);
    });

    it('rejects with 406 when guard throws', async () => {
      utils.limitOffsetGuardCheck.mockImplementation(() => {
        throw new Error('Invalid parameters');
      });

      await expect(
        MarketplaceService.getArtistProfileInMarket(artistID, limit, offset, {})
      ).rejects.toHaveProperty('status', 406);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('rejects with 406 when DB error occurs', async () => {
      utils.limitOffsetGuardCheck.mockReturnValue({ status: 200, message: { limit, offset } });
      mockQuery.mockRejectedValueOnce(new Error('DB failed'));

      await expect(
        MarketplaceService.getArtistProfileInMarket(artistID, limit, offset, {})
      ).rejects.toHaveProperty('status', 406);
    });
  });

  /* listArtworksInMarket */
  describe('listArtworksInMarket', () => {
    it('rejects if limitOffsetGuardCheck fails (status != 200)', async () => {
      utils.limitOffsetGuardCheck.mockReturnValue({
        status: 406,
        message: 'Invalid parameters',
      });

      await expect(MarketplaceService.listArtworksInMarket(-1, 10)).rejects.toHaveProperty(
        'status',
        406
      );
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('resolves with artworks on success', async () => {
      utils.limitOffsetGuardCheck.mockReturnValue({
        status: 200,
        message: { limit: 10, offset: 0 },
      });

      const mockArtworks = [{ artwork_id: 1 }, { artwork_id: 2 }, { artwork_id: 3 }];
      mockQuery.mockResolvedValueOnce({ rows: mockArtworks, rowCount: mockArtworks.length });

      const result = await MarketplaceService.listArtworksInMarket(10, 0);

      expect(result).toHaveProperty('status', 200);
      expect(result.message).toEqual(mockArtworks);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT *'), [10, 0]);
    });

    it('rejects when no artworks found', async () => {
      utils.limitOffsetGuardCheck.mockReturnValue({
        status: 200,
        message: { limit: 10, offset: 0 },
      });
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(MarketplaceService.listArtworksInMarket(10, 0)).rejects.toHaveProperty(
        'status',
        404
      );
    });

    it('rejects on database failure', async () => {
      utils.limitOffsetGuardCheck.mockReturnValue({
        status: 200,
        message: { limit: 10, offset: 0 },
      });
      mockQuery.mockRejectedValueOnce(new Error('Query failed'));

      await expect(MarketplaceService.listArtworksInMarket(10, 0)).rejects.toHaveProperty(
        'status',
        406
      );
    });
  });

  /* getArtworkProfileInMarket */
  describe('getArtworkProfileInMarket', () => {
    const artworkID = 123;
    const row = { artwork_id: artworkID, something: 'x' };

    it('resolves with single row on success', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 });

      const result = await MarketplaceService.getArtworkProfileInMarket(artworkID, {});
      expect(result).toHaveProperty('status', 200);
      expect(result.message).toEqual(row);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT *'), [artworkID]);
    });

    it('rejects with 404 when not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(
        MarketplaceService.getArtworkProfileInMarket(artworkID, {})
      ).rejects.toHaveProperty('status', 404);
    });

    it('rejects with 406 on DB error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Boom'));

      await expect(
        MarketplaceService.getArtworkProfileInMarket(artworkID, {})
      ).rejects.toHaveProperty('status', 406);
    });
  });

  /* updateArtworkInMarket */
  describe('updateArtworkInMarket', () => {
    const artworkID = 321;
    const sub = 999; 
    const body = { price: 1234 };

    it('resolves 202 when upsert + artwork update succeed', async () => {
      // 1) upsert market_listing returns rowCount = 1
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // INSERT ON CONFLICT
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPDATE artwork set price

      const result = await MarketplaceService.updateArtworkInMarket(artworkID, body, sub);

      expect(result).toHaveProperty('status', 202);
      expect(result.message).toBe('Price updated successfully');

      // Check both queries were called in order
      expect(mockQuery.mock.calls[0][0]).toContain('INSERT INTO market_listing');
      expect(mockQuery.mock.calls[0][1]).toEqual([artworkID, body.price]);
      expect(mockQuery.mock.calls[1][0]).toContain('UPDATE artwork');
      expect(mockQuery.mock.calls[1][1]).toEqual([artworkID]);
    });

    it('rejects with 404 if artwork not found (no upsert + existence check 0)', async () => {
      // upsert returns 0 (branch to existence check), existence returns 0 rows
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // upsert no change
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT 1 FROM market_listing ...

      await expect(
        MarketplaceService.updateArtworkInMarket(artworkID, body, sub)
      ).rejects.toHaveProperty('status', 404);
    });

    it('rejects with 403 if artwork exists but not owner', async () => {
      // upsert no change, existence check shows it exists
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // upsert no change
        .mockResolvedValueOnce({ rows: [{ '1': 1 }], rowCount: 1 }); // exists

      await expect(
        MarketplaceService.updateArtworkInMarket(artworkID, body, sub)
      ).rejects.toHaveProperty('status', 403);
    });

    it('rejects with 406 on DB error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Update failed'));

      await expect(
        MarketplaceService.updateArtworkInMarket(artworkID, body, sub)
      ).rejects.toHaveProperty('status', 406);
    });
  });

  /* deleteArtworkInMarket */
  describe('deleteArtworkInMarket', () => {
    const artworkID = 11;
    const sub = 77; 
    const body = {};

    it('resolves when update hides public_record (owner path)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPDATE artwork ... public_record=false

      const result = await MarketplaceService.deleteArtworkInMarket(body, artworkID, sub);

      expect(result).toHaveProperty('status', 204);
      expect(result.message).toBe('Delete an artwork successfully');
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE artwork'), [
        artworkID,
        sub,
      ]);
    });

    it('rejects with 404 when artwork does not exist', async () => {
      // first UPDATE affects 0 → run existence check → returns 0
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // UPDATE artwork
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT 1 FROM market_listing

      await expect(
        MarketplaceService.deleteArtworkInMarket(body, artworkID, sub)
      ).rejects.toHaveProperty('status', 404);
    });

    it('rejects with 403 when artwork exists but not owner', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // UPDATE artwork
        .mockResolvedValueOnce({ rows: [{ '1': 1 }], rowCount: 1 }); // exists

      await expect(
        MarketplaceService.deleteArtworkInMarket(body, artworkID, sub)
      ).rejects.toHaveProperty('status', 403);
    });

    it('rejects with 406 on DB error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Toggle failed'));

      await expect(
        MarketplaceService.deleteArtworkInMarket(body, artworkID, sub)
      ).rejects.toHaveProperty('status', 406);
    });

    it('handles SQL error with sqlMessage property', async () => {
      const sqlError = { message: 'Generic', sqlMessage: 'Specific SQL error' };
      mockQuery.mockRejectedValueOnce(sqlError);

      await expect(
        MarketplaceService.deleteArtworkInMarket(body, artworkID, sub)
      ).rejects.toHaveProperty('status', 406);
    });
  });

  /* getProfile */
  describe('getProfile', () => {
    const artistID = 500;

    it('resolves with combined profile data on success', async () => {
      // First query returns count
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '7' }], rowCount: 1 })
        // Second query returns profile fields
        .mockResolvedValueOnce({
          rows: [
            {
              first_name: 'Ada',
              last_name: 'Lovelace',
              description: 'Poetical science',
              image: 'ada.png',
            },
          ],
          rowCount: 1,
        });

      const result = await MarketplaceService.getProfile({}, artistID);

      expect(result).toHaveProperty('status', 200);
      expect(result.message).toEqual({
        first_name: 'Ada',
        last_name: 'Lovelace',
        description: 'Poetical science',
        image: 'ada.png',
        count: '7',
      });

      expect(mockQuery.mock.calls[0][0]).toContain('SELECT count(*) FROM artwork');
      expect(mockQuery.mock.calls[0][1]).toEqual([artistID]);
      expect(mockQuery.mock.calls[1][0]).toContain('SELECT first_name, last_name, description, image FROM artists');
      expect(mockQuery.mock.calls[1][1]).toEqual([artistID]);
    });

    it('rejects with 406 when artist not found (either query empty)', async () => {
      // Case 1: first query empty
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await expect(MarketplaceService.getProfile({}, artistID)).rejects.toHaveProperty(
        'status', 406);

      // Case 2: first ok, second empty
      mockQuery.mockReset();
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(MarketplaceService.getProfile({}, artistID)).rejects.toHaveProperty(
        'status', 406);
    });

    it('rejects with 406 on DB error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Profile boom'));

      await expect(MarketplaceService.getProfile({}, artistID)).rejects.toHaveProperty(
        'status',
        406
      );
    });
  });
});
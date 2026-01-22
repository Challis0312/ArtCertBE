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
const ArtworkService = require('../../src/services/ArtworkService');
const db = require('../../src/database/getDBPool');
const utils = require('../../src/utils/limitOffsetGuardCheck');
const variableGuards = require('../../src/utils/variableGuardCheck');

describe('ArtworkService', () => {
  let mockQuery;

  beforeEach(() => {
    // Get reference to the mocked query function
    mockQuery = jest.fn();
    db.getDBPool.mockResolvedValue({
      query: mockQuery,
      end: jest.fn()
    });
    jest.clearAllMocks();
  });

  describe('postArtwork', () => {
    const validArtworkData = {
      artistID: 1,
      ownerID: 2,
      artworkName: 'Test Artwork',
      dimension: '24x36',
      artMedium: 'Oil on canvas',
      dateOfProduction: '2023-01-01'
    };

    it('resolves with message and status on successful creation', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ artwork_id: 123 }]
      });

      const result = await ArtworkService.postArtwork(validArtworkData);

      expect(result).toHaveProperty('status', 200);
      expect(result).toHaveProperty('message');
      expect(result.message).toEqual([{ ArtworkID: 123 }]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO artwork"),
        [1, 2, 'Test Artwork', '24x36', 'Oil on canvas', '2023-01-01', false, false, false, false]
      );
    });

    it('rejects with message and status on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(ArtworkService.postArtwork(validArtworkData))
        .rejects.toHaveProperty('status', 406);
    });

    it('rejects when no rows returned', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(ArtworkService.postArtwork(validArtworkData))
        .rejects.toHaveProperty('status', 404);
    });
  });

  describe('listArtworks', () => {
    it('rejects if limitOffsetGuardCheck fails', async () => {
      utils.limitOffsetGuardCheck.mockReturnValue({
        status: 406,
        message: 'Invalid parameters'
      });

      await expect(ArtworkService.listArtworks(-1, 10))
        .rejects.toHaveProperty('status', 406);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('resolves with artworks on success', async () => {
      utils.limitOffsetGuardCheck.mockReturnValue({
        status: 200,
        message: { limit: 10, offset: 0 }
      });

      const mockArtworks = [
        { artwork_id: 1 },
        { artwork_id: 2 },
        { artwork_id: 3 }
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockArtworks });

      const result = await ArtworkService.listArtworks(0, 10);

      expect(result).toHaveProperty('status', 200);
      expect(result.message).toEqual([
        { artwork_id: 1 },
        { artwork_id: 2 },
        { artwork_id: 3 }
      ]);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM artwork LIMIT $1 OFFSET $2;',
        [10, 0]
      );
    });

    it('rejects when no artworks found', async () => {
      utils.limitOffsetGuardCheck.mockReturnValue({
        status: 200,
        message: { limit: 10, offset: 0 }
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(ArtworkService.listArtworks(0, 10))
        .rejects.toHaveProperty('status', 404);
    });

    it('rejects on database failure', async () => {
      utils.limitOffsetGuardCheck.mockReturnValue({
        status: 200,
        message: { limit: 10, offset: 0 }
      });
      mockQuery.mockRejectedValueOnce(new Error('Query failed'));

      await expect(ArtworkService.listArtworks(0, 10))
        .rejects.toHaveProperty('status', 406);
    });
  });

  describe('getArtworkData', () => {
    const artworkID = 123;
    const mockArtwork = {
      artwork_id: 123,
      artists_id: 1,
      artwork_name: 'Test Artwork',
      description: 'Test description',
      dimensions: '24x36',
      art_medium: 'Oil',
      date_of_production: '2023-01-01',
      verified: false,
      toggle: true,
      public_record: false,
      deleted: false
    };

    it('resolves with artwork data on success', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockArtwork] });

      const result = await ArtworkService.getArtworkData(artworkID);

      expect(result).toHaveProperty('status', 202);
      expect(result.message).toEqual(mockArtwork);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT *'),
        [artworkID]
      );
    });

    it('rejects when artwork not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(ArtworkService.getArtworkData(artworkID))
        .rejects.toHaveProperty('status', 404);
    });

    it('rejects on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      await expect(ArtworkService.getArtworkData(artworkID))
        .rejects.toHaveProperty('status', 406);
    });
  });

  describe('putArtwork', () => {
    const artworkID = 123;

    it('resolves when artwork updated successfully', async () => {
      const updateData = {
        artworkName: 'Updated Artwork Name',
        description: 'Updated description',
        verified: true
      };
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await ArtworkService.putArtwork(artworkID, updateData);

      expect(result).toHaveProperty('status', 202);
      expect(result.message).toBe(artworkID + 'Artwork updated successfully');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE artwork SET'),
        ['Updated Artwork Name', 'Updated description', true, artworkID]
      );
    });

    it('rejects when no valid fields to update', async () => {
      const emptyData = {};

      await expect(ArtworkService.putArtwork(artworkID, emptyData))
        .rejects.toHaveProperty('status', 400);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('filters out null and undefined values', async () => {
      const dataWithNulls = {
        artworkName: 'Valid Name',
        description: null,
        dimension: undefined,
        verified: true
      };
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await ArtworkService.putArtwork(artworkID, dataWithNulls);

      expect(result).toHaveProperty('status', 202);
      expect(result.message).toBe(artworkID + 'Artwork updated successfully');
      
      // Check that only non-null/undefined values are included in the query
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE artwork SET'),
        ['Valid Name', true, artworkID] // Only artworkName and verified values, plus artworkID
      );
      
      // Verify the SQL contains only the valid field mappings
      const [query] = mockQuery.mock.calls[0];
      expect(query).toContain('artwork_name = $1');
      expect(query).toContain('verified = $2');
      expect(query).toContain('WHERE artwork_id = $3');
      expect(query).not.toContain('description');
      expect(query).not.toContain('dimensions');
    });

    it('rejects when artwork not found', async () => {
      const updateData = { artworkName: 'Test' };
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      await expect(ArtworkService.putArtwork(artworkID, updateData))
        .rejects.toHaveProperty('status', 404);
    });

    it('rejects on database error', async () => {
      const updateData = { artworkName: 'Test' };
      mockQuery.mockRejectedValueOnce(new Error('Update failed'));

      await expect(ArtworkService.putArtwork(artworkID, updateData))
        .rejects.toHaveProperty('status', 406);
    });

    it('correctly maps all field names', async () => {
      const allFields = {
        artistID: 1,
        artworkName: 'Test Name',
        description: 'Test Description',
        dimension: 'Test Dimension',
        artMedium: 'Test Medium',
        dateOfProduction: '2023-01-01',
        verified: true,
        toggle: false,
        publicRecord: true,
        deleted: false
      };
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await ArtworkService.putArtwork(123, allFields);

      expect(result).toHaveProperty('status', 202);
      expect(result.message).toBe(123 + 'Artwork updated successfully');

      const [query, params] = mockQuery.mock.calls[0];
      
      // Check that all fields are properly mapped in the query
      expect(query).toContain('artists_id = $1');
      expect(query).toContain('artwork_name = $2');
      expect(query).toContain('description = $3');
      expect(query).toContain('dimensions = $4');
      expect(query).toContain('art_medium = $5');
      expect(query).toContain('date_of_production = $6');
      expect(query).toContain('verified = $7');
      expect(query).toContain('toggle = $8');
      expect(query).toContain('public_record = $9');
      expect(query).toContain('deleted = $10');
      expect(query).toContain('WHERE artwork_id = $11');

      expect(params).toEqual([1, 'Test Name', 'Test Description', 'Test Dimension', 'Test Medium', '2023-01-01', true, false, true, false, 123]);
    });
  });

  describe('toggleArtwork', () => {
    const artworkID = 123;
    const body = {};

    it('resolves when artwork toggled successfully', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await ArtworkService.toggleArtwork(artworkID, body);

      expect(result).toHaveProperty('status', 204);
      expect(result).toHaveProperty('message', 'Toggle successfully');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(`UPDATE artwork
                SET toggle = NOT toggle
                WHERE artwork_id = $1`),
        [artworkID]
      );
    });

    it('rejects when artwork not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(ArtworkService.toggleArtwork(artworkID, body))
        .rejects.toHaveProperty('status', 404);
    });

    it('rejects on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Toggle failed'));

      await expect(ArtworkService.toggleArtwork(artworkID, body))
        .rejects.toHaveProperty('status', 406);
    });

    it('handles SQL error with sqlMessage property', async () => {
      const sqlError = {
        message: 'Generic error',
        sqlMessage: 'Specific SQL error message'
      };
      mockQuery.mockRejectedValueOnce(sqlError);

      await expect(ArtworkService.toggleArtwork(artworkID, body))
        .rejects.toHaveProperty('status', 406);
    });
  });
});
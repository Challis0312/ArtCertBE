const MAXLIMIT = 10000;

exports.limitOffsetGuardCheck = function(limit, offset){
	// Input guard for limit and offset
	var errorStatus = false; 
	var errorMessage = 'error'
	if(!limit && !offset){
		limit = 1000;
		offset = 0;
	}
	else if (limit === undefined || limit === null || offset === undefined || offset === null){
		throw new Error('Guard Check: limit and offset cannot be null if the other exists');
	}
	else if(limit < 0){
		throw new Error('Guard Check: limit cannot be less than 0');
	}
	else if(offset < 0){
		throw new Error('Guard Check: offset cannot be less than 0');
	}
	else if(limit > MAXLIMIT){
		throw new Error('Guard Check: limit exceeds viable range');
	}
	return {message: {limit: limit, offset: offset}, status: 200};
}



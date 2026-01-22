const NAMELENGTHMAX = 50;
const EMAILLENGTHMAX = 100;
const EMAILLENGTHMIN = 3;
const MOBILELENGTHMAX = 13;
const MOBILELENGTHMIN = 9;


exports.idGuardCheck = function(identifier){
	
	if(identifier===undefined || identifier === null){
		throw new Error('Guard Check: identifier cannot be null');
	}

	if (!Number.isInteger(parseInt(identifier))){
		throw new Error('Guard Check: identifier must be an int');
	}

	if( parseInt(identifier)  < 0){
		throw new Error(`Guard Check: identifier "${identifier}" must be a positive number`);
	}
}

export type ChamberCode = "house" | "senate";

export interface Chamber {
	id?: number;
	code: ChamberCode;
	name: string;
}

export interface Member {
	id?: number;
	officialId?: string;
	bioguideId?: string;
	fullName: string;
	firstName?: string;
	middleName?: string;
	lastName?: string;
	suffix?: string;
	chamber: ChamberCode;
	state: string;
	district?: string;
	party?: string;
	officialProfileUrl?: string;
	isCurrent: boolean;
	sourceDocumentId?: number;
	createdAt?: Date;
	updatedAt?: Date;
}

export interface MemberTerm {
	id?: number;
	memberId: number;
	chamber: ChamberCode;
	congressNumber?: number;
	state: string;
	district?: string;
	party?: string;
	startDate?: string;
	endDate?: string;
	sourceDocumentId?: number;
}

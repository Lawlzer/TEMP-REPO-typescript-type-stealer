import { Hello1, Hello2, Hello3 } from './temp';

export interface one {
	hello: Hello1;
}

export interface two {
	[hello: string]: Hello2;
}

export interface three extends Hello3 {
	wow: true;
}

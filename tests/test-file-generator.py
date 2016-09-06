import csv
import random
import datetime

outfile = 'test.txt'
dateformat = '%d.%m.%Y %H:%M:%S'
low = 0
high = 10
rowlenght = 8
linelength = 10000
valueseperator = ','

d1 = datetime.datetime.now()
with open(outfile, 'w', newline='') as csvfile:
    writer = csv.writer(csvfile, delimiter=',')
    for i in range(0,linelength):
        r = [round(random.uniform(low, high), 5) for _ in range(rowlenght)]
        r.insert(0, (d1 + datetime.timedelta(seconds=i)).strftime(dateformat))
        writer.writerow(r)

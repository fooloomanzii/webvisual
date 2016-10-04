import csv
import random
import datetime
from threading import Event, Thread

outfile = 'test.txt'
dateformat = '%d.%m.%Y %H:%M:%S'
low = 0
high = 10
rowlenght = 8
initialLineLength = 10
valueseperator = ','
interval = 1


def createRow(d, i):
    with open(outfile, 'a') as csvfile:
        writer = csv.writer(csvfile, delimiter=valueseperator)
        r = [round(random.uniform(low, high), 5) for _ in range(rowlenght)]
        r.insert(0, (d + datetime.timedelta(seconds=i)).strftime(dateformat))
        print(r)
        writer.writerow(r)


def intervalWrite(interval):
    stopped = Event()
    def loop():
        while not stopped.wait(interval): # the first call is in `interval` secs
            createRow(datetime.datetime.now(), 0)
    Thread(target=loop).start()
    return stopped.set

open(outfile, 'w').close()
d = datetime.datetime.now()
for i in range(-initialLineLength, 0):
    createRow(d, i*interval)
intervalWrite(interval)
